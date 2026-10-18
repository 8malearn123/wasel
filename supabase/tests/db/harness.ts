import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

const ROOT = path.resolve(__dirname, "../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const SUPPORT_DIR = path.join(ROOT, "supabase/tests/support");

/** Applied right before this migration: it references the never-committed wholesale_* tables. */
const WHOLESALE_DEPENDENT = "20260309011255_930be945-7ce2-4e15-a726-68332a95bb52.sql";
/** Legacy data is seeded right before the first migration at or after this prefix. */
const SEED_BEFORE = "20261018100000";

// numeric -> JS number (amounts in this schema have at most 2 decimals), bigint -> number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

/** Refuses anything that looks like a hosted database: the suite creates and drops databases. */
export function adminUrlFromEnv(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a throwaway Postgres 15+ superuser connection, e.g.\n" +
        "  docker run -d --name wasel-test-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:16\n" +
        "  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres npm run test:db",
    );
  }
  const host = new URL(url).hostname;
  if (/supabase\.(co|com|net)$/.test(host)) {
    throw new Error(`Refusing to run destructive DB tests against ${host}. Use a local/CI Postgres.`);
  }
  return url;
}

function urlForDatabase(adminUrl: string, database: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${database}`;
  return u.toString();
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function runFile(client: pg.Client, file: string) {
  const sql = fs.readFileSync(file, "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error(`Failed applying ${path.relative(ROOT, file)}: ${(err as Error).message}`);
  }
}

/**
 * Builds the template database: Supabase stand-ins, every migration in filename
 * order (each in its own transaction, like `supabase db push`), and the legacy
 * fixture right before the Phase 0 migrations.
 */
export async function buildTemplate(adminUrl: string, name: string) {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${quoteIdent(name)}`);
  await admin.end();

  const client = new pg.Client({ connectionString: urlForDatabase(adminUrl, name) });
  client.on("notice", () => {}); // e.g. "pg_cron not scheduled" on plain Postgres
  await client.connect();
  try {
    await runFile(client, path.join(SUPPORT_DIR, "supabase_stubs.sql"));
    let seeded = false;
    const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of migrations) {
      if (file === WHOLESALE_DEPENDENT) await runFile(client, path.join(SUPPORT_DIR, "wholesale_stub.sql"));
      if (!seeded && file >= SEED_BEFORE) {
        await runFile(client, path.join(SUPPORT_DIR, "legacy_seed.sql"));
        seeded = true;
      }
      await runFile(client, path.join(MIGRATIONS_DIR, file));
    }
    if (!seeded) throw new Error(`No migration at or after ${SEED_BEFORE}; legacy fixture was never applied`);
  } finally {
    await client.end();
  }
}

export async function dropDatabase(adminUrl: string, name: string) {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
  await admin.end();
}

export type Identity = { role: "anon" } | { role: "authenticated"; userId: string };
export const anon: Identity = { role: "anon" };
export const user = (userId: string): Identity => ({ role: "authenticated", userId });

function rpcSql(fn: string, args: Record<string, unknown>) {
  if (!/^\w+$/.test(fn)) throw new Error(`Bad function name ${fn}`);
  const keys = Object.keys(args).filter((k) => args[k] !== undefined);
  for (const k of keys) if (!/^\w+$/.test(k)) throw new Error(`Bad argument name ${k}`);
  // pg sends JS arrays as Postgres arrays, so JSON values are serialized explicitly.
  const values = keys.map((k) => {
    const v = args[k];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  const params = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  return { text: `SELECT public.${fn}(${params}) AS result`, values };
}

/** A transaction opened the way PostgREST does it: API role + JWT claim, local to the transaction. */
export class Tx {
  constructor(private client: pg.PoolClient) {}

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    return (await this.client.query<T>(text, values)).rows;
  }

  async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { text, values } = rpcSql(fn, args);
    const rows = await this.query<{ result: T }>(text, values);
    return rows[0].result;
  }

  async commit() {
    try {
      await this.client.query("COMMIT");
    } finally {
      this.client.release();
    }
  }

  async rollback() {
    try {
      await this.client.query("ROLLBACK");
    } finally {
      this.client.release();
    }
  }
}

export class Session {
  constructor(private pool: pg.Pool, private identity: Identity) {}

  async begin(): Promise<Tx> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${this.identity.role}`);
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
        this.identity.role === "authenticated" ? this.identity.userId : "",
      ]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      throw err;
    }
    return new Tx(client);
  }

  /** One request = one transaction, committed on success, rolled back on error. */
  private async request<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const tx = await this.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    return this.request((tx) => tx.query<T>(text, values));
  }

  rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}) {
    return this.request((tx) => tx.rpc<T>(fn, args));
  }
}

/** A private clone of the template database, for one test. */
export class TestDb {
  private constructor(
    readonly name: string,
    private adminUrl: string,
    readonly pool: pg.Pool,
  ) {}

  static async create(adminUrl: string, template: string): Promise<TestDb> {
    const name = `wasel_test_${randomBytes(4).toString("hex")}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${quoteIdent(name)} TEMPLATE ${quoteIdent(template)}`);
    await admin.end();
    const pool = new pg.Pool({ connectionString: urlForDatabase(adminUrl, name), max: 40 });
    pool.on("connect", (c) => c.on("notice", () => {}));
    // Idle clients get "terminating connection" when the clone is force-dropped; that is expected.
    pool.on("error", () => {});
    return new TestDb(name, adminUrl, pool);
  }

  async destroy() {
    await this.pool.end();
    await dropDatabase(this.adminUrl, this.name);
  }

  /** Superuser access (bypasses RLS) for arranging state and asserting on it. */
  async sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    return (await this.pool.query<T>(text, values)).rows;
  }

  async one<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    const rows = await this.sql<T>(text, values);
    if (rows.length !== 1) throw new Error(`Expected 1 row, got ${rows.length}: ${text}`);
    return rows[0];
  }

  as(identity: Identity) {
    return new Session(this.pool, identity);
  }
}
