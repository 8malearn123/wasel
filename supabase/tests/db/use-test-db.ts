import { afterEach, beforeEach, inject } from "vitest";
import { TestDb } from "./harness";

/**
 * Gives every test in the calling file its own fresh clone of the migrated,
 * seeded template database, dropped again after the test.
 */
export function useTestDb(): () => TestDb {
  let db: TestDb | undefined;

  beforeEach(async () => {
    db = await TestDb.create(inject("adminUrl"), inject("templateDb"));
  });

  afterEach(async () => {
    await db?.destroy();
    db = undefined;
  });

  return () => {
    if (!db) throw new Error("useTestDb(): database is only available inside a test");
    return db;
  };
}
