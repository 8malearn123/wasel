// @vitest-environment node
/**
 * The security migration and the two guard migrations, run on a real Postgres
 * (PGlite, in memory) with the production tables they touch reduced to the
 * columns involved. Every case states what must be accepted and what refused.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';

const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8');
const refused = async (db: PGlite, sql: string) => { await expect(db.query(sql)).rejects.toThrow(); };

describe('20261019120000 secure login codes and storefront orders', () => {
  const db = new PGlite();
  const MID = '00000000-0000-4000-8000-00000000000a', OTHER = '00000000-0000-4000-8000-00000000000b';
  const D1 = '00000000-0000-4000-8000-0000000000d1', D2 = '00000000-0000-4000-8000-0000000000d2', DX = '00000000-0000-4000-8000-0000000000dd';
  const A1 = '00000000-0000-4000-8000-0000000000a1';
  const U_OWNER = '00000000-0000-4000-8000-0000000000f1', U_CASHIER = '00000000-0000-4000-8000-0000000000f2';
  
  const cust = (o: Record<string, unknown> = {}) => JSON.stringify({ customer_name: 'نورة', customer_phone: '0554443332', shipping_address: 'حي النرجس', shipping_city: 'الرياض', payment_method: 'cod', shipping_option: 'naqel', ...o }).replace(/'/g, "''");
  const place = (items: unknown[], c = cust(), m = MID) => `select place_online_order('${m}', '${c}'::jsonb, '${JSON.stringify(items)}'::jsonb) as r`;
  const as = async (role: 'anon' | 'authenticated', uid = '') => { await db.exec(`RESET ROLE; SET test.uid = '${uid}'; SET ROLE ${role}`); };

  beforeAll(async () => {
    await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    CREATE TYPE device_status AS ENUM ('available','reserved','sold','transferred','repair');
    CREATE TYPE shipping_provider AS ENUM ('aramex','smsa','other');
    CREATE TYPE online_order_status AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled','refunded');
    CREATE TYPE payment_status AS ENUM ('paid','unpaid','partial');
    CREATE TABLE merchant_users (id uuid primary key default gen_random_uuid(), merchant_id uuid, user_id uuid, role text, branch_id uuid, is_active boolean default true, login_code text, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE FUNCTION get_user_merchant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ select merchant_id from public.merchant_users where user_id = auth.uid() limit 1 $$;
    CREATE FUNCTION is_owner_or_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ select exists(select 1 from public.merchant_users where user_id = auth.uid() and role in ('owner','admin')) $$;
    CREATE FUNCTION public.get_user_login_code(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT CASE WHEN is_owner_or_admin() THEN login_code WHEN mu.user_id = auth.uid() THEN login_code ELSE NULL END
      FROM public.merchant_users mu WHERE mu.user_id = _user_id AND mu.merchant_id = get_user_merchant_id() LIMIT 1 $$;
    ALTER TABLE merchant_users ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, UPDATE ON merchant_users TO authenticated;
    CREATE POLICY "Members view colleagues" ON merchant_users FOR SELECT TO authenticated USING (merchant_id = get_user_merchant_id());
    CREATE POLICY "Users can view own merchant members" ON merchant_users FOR SELECT TO authenticated USING (merchant_id = get_user_merchant_id());
    CREATE VIEW merchant_users_safe AS SELECT id, merchant_id, user_id, role FROM merchant_users;
    CREATE TABLE store_settings (merchant_id uuid, is_published boolean, shipping_cost numeric, free_shipping_threshold numeric);
    CREATE TABLE store_pages (merchant_id uuid, slug text, content text);
    CREATE TABLE devices (id uuid primary key, merchant_id uuid, brand text, model text, storage text, price numeric, status device_status);
    CREATE TABLE accessories (id uuid primary key, merchant_id uuid, name text, price numeric, quantity int, status text);
    CREATE TABLE online_orders (id uuid primary key default gen_random_uuid(), merchant_id uuid, order_number text, status online_order_status default 'pending', payment_status payment_status default 'unpaid',
      customer_name text, customer_phone text, customer_email text, shipping_address text, shipping_city text, shipping_cost numeric, payment_method text, shipping_provider shipping_provider, tracking_number text,
      subtotal numeric, tax_amount numeric, discount_amount numeric, total_amount numeric, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE online_order_items (id uuid primary key default gen_random_uuid(), order_id uuid, device_id uuid, accessory_id uuid, item_name text, item_image text, quantity int, unit_price numeric, created_at timestamptz default now());
    ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;
    GRANT INSERT, SELECT ON online_orders, online_order_items TO anon, authenticated;
    CREATE POLICY "Anyone can place orders" ON online_orders FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anyone can create order items" ON online_order_items FOR INSERT TO anon WITH CHECK (true);
    CREATE SEQUENCE ono; CREATE FUNCTION generate_online_order_number(_merchant_id uuid) RETURNS text LANGUAGE sql AS $$ select 'ON-T-' || lpad(nextval('ono')::text, 3, '0') $$;
    INSERT INTO merchant_users (merchant_id, user_id, role, login_code) VALUES ('${MID}','${U_OWNER}','owner','111111'),('${MID}','${U_CASHIER}','cashier','222222');
    INSERT INTO store_settings VALUES ('${MID}', true, 25, 5000), ('${OTHER}', false, 10, null);
    INSERT INTO store_pages VALUES ('${MID}', '__design', '{"carriers":[{"id":"naqel","enabled":true,"cost":30},{"id":"aramex","enabled":true,"cost":20},{"id":"smsa","enabled":false,"cost":5}]}');
    INSERT INTO devices VALUES ('${D1}','${MID}','Apple','iPhone 14 Pro','256GB',3899,'available'),('${D2}','${MID}','Samsung','A55',null,1349,'sold'),('${DX}','${OTHER}','X','Y',null,10,'available');
    INSERT INTO accessories VALUES ('${A1}','${MID}','باور بانك',130,19,null);
    `);
        await db.exec(migration('20261019120000_secure_login_codes_and_storefront_orders.sql'));
  });

  it('a visitor cannot write an order or a line directly', async () => {
    await as('anon');
    await refused(db, `insert into online_orders (merchant_id, order_number, payment_status, total_amount) values ('${MID}','X','paid',1)`);
    await refused(db, `insert into online_order_items (order_id, item_name, quantity, unit_price) values (gen_random_uuid(),'x',1,0.01)`);
  });

  it('prices come from the shop; shipping by the chosen carrier; VAT on goods and delivery; always pending/unpaid', async () => {
    await as('anon');
    const r = (await db.query<{ r: any }>(place([{ device_id: D1, unit_price: 1 }, { accessory_id: A1, quantity: 2 }]))).rows[0].r;
    expect(r).toMatchObject({ order_number: 'ON-T-001', subtotal: 4159, shipping_cost: 30, tax_amount: 628.35, total_amount: 4817.35 });
    expect(r.items[0].unit_price).toBe(3899);
    await db.exec('RESET ROLE');
    const row = (await db.query<any>(`select status, payment_status, shipping_provider, tracking_number from online_orders where order_number = 'ON-T-001'`)).rows[0];
    expect(row).toEqual({ status: 'pending', payment_status: 'unpaid', shipping_provider: 'other', tracking_number: 'naqel:' });
  });

  it('free shipping above the threshold; Aramex stored as aramex', async () => {
    await as('anon');
    const r = (await db.query<{ r: any }>(place([{ device_id: D1 }, { accessory_id: A1, quantity: 9 }], cust({ shipping_option: 'aramex' })))).rows[0].r;
    expect(r).toMatchObject({ subtotal: 5069, shipping_cost: 0, tax_amount: 760.35, total_amount: 5829.35 });
  });

  it.each([
    ['a carrier the shop switched off', () => place([{ accessory_id: A1 }], cust({ shipping_option: 'smsa' }))],
    ['a sold device', () => place([{ device_id: D2 }])],
    ['the same device twice', () => place([{ device_id: D1 }, { device_id: D1 }])],
    ["another shop's device", () => place([{ device_id: DX }])],
    ['more accessories than in stock', () => place([{ accessory_id: A1, quantity: 50 }])],
    ['a payment method with no gateway', () => place([{ accessory_id: A1 }], cust({ payment_method: 'mada' }))],
    ['an unpublished store', () => place([{ accessory_id: A1 }], cust(), OTHER)],
    ['a blank name', () => place([{ accessory_id: A1 }], cust({ customer_name: ' ' }))],
  ])('refuses %s', async (_name, sql) => {
    await as('anon');
    await refused(db, sql());
  });

  it('tracking answers one order, only with the right last four digits', async () => {
    await as('anon');
    expect((await db.query<{ r: any }>(`select track_online_order('ON-T-001','3332') as r`)).rows[0].r.order.order_number).toBe('ON-T-001');
    expect((await db.query<{ r: any }>(`select track_online_order('ON-T-001','0000') as r`)).rows[0].r).toBeNull();
  });

  it('a cashier cannot read login codes; owners and the user themselves can, through the function', async () => {
    await as('authenticated', U_CASHIER);
    await refused(db, 'select login_code from merchant_users');
    expect((await db.query('select user_id, role from merchant_users')).rows).toHaveLength(2);
    expect((await db.query<{ r: string | null }>(`select get_user_login_code('${U_OWNER}') as r`)).rows[0].r).toBeNull();
    expect((await db.query<{ r: string }>(`select get_user_login_code('${U_CASHIER}') as r`)).rows[0].r).toBe('222222');
    await as('authenticated', U_OWNER);
    expect((await db.query<{ r: string }>(`select get_user_login_code('${U_CASHIER}') as r`)).rows[0].r).toBe('222222');
    await db.query(`update merchant_users set login_code = '333333' where user_id = '${U_CASHIER}'`);
    await as('anon');
    await refused(db, `select get_user_login_code('${U_OWNER}')`);
  });
});
