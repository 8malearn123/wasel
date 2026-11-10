#!/usr/bin/env python3
"""Plan the copy of the three demo shops from production into wasel-staging.

Reads the live catalogue (catalog.json, produced by staging-init.sh through the
read-only login) and prints, per public table, how it is copied:

  merchant     rows whose shop columns all point at a demo shop
  parent       rows whose parent row (through a foreign key) is copied
  users        rows of the demo shops' members (profiles)
  reference    shared catalogue tables copied whole (plans)
  skip         not copied (payouts, platform admins, unknown tables)

Personal data never leaves production: the SELECT that reads each table
replaces names, phones, emails, addresses, IMEIs, bank details, login codes and
free-text notes with test values derived from the row id, so the same row gets
the same test value on every copy. Only the rewritten values reach staging.

  python3 staging_copy_plan.py catalog.json "<id1>,<id2>,<id3>" > plan.json
"""
import json
import sys

catalog = json.load(open(sys.argv[1]))
demo = [d.strip() for d in sys.argv[2].split(',') if d.strip()]
demo_list = ', '.join(f"'{d}'::uuid" for d in demo)

SKIP = {
    'merchant_payouts': 'real bank transfers — never copied',
    'platform_admins': 'production platform admins — staging gets its own',
}
REFERENCE = {'plans'}

h = lambda col: f"md5(t.{col}::text)"  # noqa: E731
FAKE = {
    'name_person': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'عميل تجريبي ' || left({h('id')}, 6) END",
    'name_user': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'مستخدم تجريبي ' || left({h('id')}, 6) END",
    'phone': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE '05' || lpad(((('x' || left({h('id')}, 7))::bit(28)::int) % 100000000)::text, 8, '0') END",
    'email': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'c-' || left({h('id')}, 10) || '@wasel-staging.test' END",
    'address': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'عنوان تجريبي' END",
    'null': lambda c: 'NULL',
    # the same IMEI maps to the same test IMEI in every table ('00' = test range)
    'imei': lambda c: f"CASE WHEN t.{c} IS NULL OR btrim(t.{c}) = '' THEN t.{c} ELSE '00' || lpad(((('x' || left(md5(t.{c}), 12))::bit(48)::bigint) % 10000000000000)::text, 13, '0') END",
    'login_code': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE lpad(((('x' || left({h('id')}, 7))::bit(28)::int) % 100000)::text, 5, '0') END",
    'iban': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'SA0000000000000000000000' END",
    'text_placeholder': lambda c: f"CASE WHEN t.{c} IS NULL THEN NULL ELSE 'نص تجريبي' END",
}
# table -> column -> kind. Columns absent from the live table are ignored.
OVERRIDES = {
    'customers': {'name': 'name_person', 'phone': 'phone', 'email': 'email', 'address': 'address', 'notes': 'null'},
    'online_orders': {'customer_name': 'name_person', 'customer_phone': 'phone', 'customer_email': 'email',
                      'shipping_address': 'address', 'notes': 'null', 'payment_reference': 'null'},
    'repair_orders': {'customer_name': 'name_person', 'customer_phone': 'phone', 'notes': 'null'},
    'profiles': {'full_name': 'name_user', 'phone': 'phone', 'avatar_url': 'null'},
    'merchants': {'phone': 'phone', 'email': 'email', 'address': 'address', 'iban': 'iban', 'bank_account': 'null',
                  'cr_number': 'null', 'vat_number': 'null'},
    'suppliers': {'phone': 'phone', 'email': 'email', 'address': 'address', 'notes': 'null'},
    'merchant_users': {'login_code': 'login_code'},
    'support_tickets': {'description': 'text_placeholder', 'admin_reply': 'text_placeholder'},
    'activity_logs': {'ip_address': 'null', 'old_data': 'null'},
    'wholesale_credit_transactions': {'notes': 'null'},
}

tables = {t['name']: t for t in catalog['tables']}
user_cols_named = {'user_id', 'created_by', 'processed_by', 'assigned_to', 'replied_by', 'requested_by', 'granted_by'}


def shop_columns(t):
    return [c['name'] for c in t['columns'] if c['name'] == 'merchant_id' or c['name'].endswith('_merchant_id')]


def shop_where(name, alias='t'):
    t = tables[name]
    if name == 'merchants':
        return f"{alias}.id IN ({demo_list})"
    cols = shop_columns(t)
    if not cols:
        return None
    # every shop column must be a demo shop (or empty): a wholesale order
    # between a demo shop and a real one is not copied
    parts = [f"({alias}.{c} IS NULL OR {alias}.{c} IN ({demo_list}))" for c in cols]
    any_set = ' OR '.join(f"{alias}.{c} IS NOT NULL" for c in cols)
    return '(' + ' AND '.join(parts) + f') AND ({any_set})'


def select_list(t):
    over = OVERRIDES.get(t['name'], {})
    out = []
    for c in t['columns']:
        if c['generated']:
            continue
        kind = over.get(c['name'])
        if kind is None and 'imei' in c['name']:
            kind = 'imei'
        expr = FAKE[kind](c['name']) if kind else f"t.{c['name']}"
        out.append((c['name'], expr))
    # activity_logs.new_data keeps only what role tests need (custom roles)
    if t['name'] == 'activity_logs':
        out = [(n, "CASE WHEN t.action ILIKE '%role%' THEN t.new_data ELSE NULL END" if n == 'new_data' else e) for n, e in out]
    return out


plan = []
for name in sorted(tables):
    t = tables[name]
    entry = {'table': name}
    where = None
    if name in SKIP:
        entry.update(rule='skip', reason=SKIP[name])
    elif name in REFERENCE:
        entry.update(rule='reference')
        where = 'true'
    else:
        where = shop_where(name)
        if where:
            entry['rule'] = 'merchant'
        else:
            for fk in t['fks']:
                if fk['ref_schema'] == 'public' and fk['ref_table'] in tables and len(fk['cols']) == 1:
                    pw = shop_where(fk['ref_table'], 'p')
                    if pw:
                        where = f"t.{fk['cols'][0]} IN (SELECT p.{fk['ref_cols'][0]} FROM public.{fk['ref_table']} p WHERE {pw})"
                        entry.update(rule='parent', via=f"{fk['cols'][0]} → {fk['ref_table']}")
                        break
            if not where and any(fk['ref_schema'] == 'auth' for fk in t['fks']):
                fk = next(fk for fk in t['fks'] if fk['ref_schema'] == 'auth')
                where = (f"t.{fk['cols'][0]} IN (SELECT mu.user_id FROM public.merchant_users mu "
                         f"WHERE mu.merchant_id IN ({demo_list}))")
                entry.update(rule='users', via=f"{fk['cols'][0]} → auth.users")
            if not where:
                entry.update(rule='skip', reason='not linked to a shop — not copied')
    if where:
        cols = select_list(t)
        entry['columns'] = [n for n, _ in cols]
        entry['select'] = 'SELECT ' + ', '.join(e for _, e in cols) + f" FROM public.{name} t WHERE {where}"
        entry['count'] = f"SELECT count(*) FROM public.{name} t WHERE {where}"
        # uuid columns that hold a sign-in account and must be remapped in staging
        auth_fk_cols = {fk['cols'][0] for fk in t['fks'] if fk['ref_schema'] == 'auth' and len(fk['cols']) == 1}
        entry['user_columns'] = [
            {'name': c['name'], 'notnull': c['notnull']}
            for c in t['columns']
            if c['type'] == 'uuid' and (c['name'] in auth_fk_cols or c['name'] in user_cols_named)
               and not (name == 'profiles' and c['name'] == 'id' and c['name'] not in auth_fk_cols)
        ]
        if name == 'profiles' and 'id' in auth_fk_cols:
            entry['user_columns'] = [{'name': 'id', 'notnull': True}] + [u for u in entry['user_columns'] if u['name'] != 'id']
    plan.append(entry)

json.dump(plan, sys.stdout, ensure_ascii=False, indent=1)
