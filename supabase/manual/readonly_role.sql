-- =============================================================================
-- A read-only database login for the check and backup workflows
--
-- Not a migration: run it once, by hand, in Supabase → SQL Editor (it runs as
-- the project's `postgres` role). Nothing here changes a row; it adds one role
-- and grants it SELECT.
--
-- What the role CAN do:   connect (at most 3 sessions), read every table and
--                         sequence value in `public` and the migration history,
--                         until the expiry date below.
-- What it CANNOT do:      insert, update, delete or truncate anything; create,
--                         alter or drop any object; create roles or databases;
--                         use nextval() on a sequence; act as any other role
--                         (it is a member of none). The workflows check every
--                         one of these before they read anything
--                         (.github/scripts/db-readonly-guard.sh) and stop if
--                         one is not so.
-- One path is not closed by grants: functions that are SECURITY DEFINER and
-- executable by PUBLIC run with their owner's rights for any caller — this
-- role, and also every visitor holding the public anon key. The role is no
-- stronger than a visitor there; its sessions are also read-only by default,
-- which stops those functions writing; the workflows never call functions;
-- and the guard lists them (closing them is issue 41, phase 1).
--
-- Before running: replace CHANGE_ME with a long random password (e.g. 32+
-- characters from a password manager). The SQL Editor keeps run queries in
-- its history: after running, delete this query from the history, or set
-- the password from Database → Roles instead and drop the PASSWORD clause.
-- Never paste the password into a chat, an issue or a file.
-- =============================================================================

CREATE ROLE wasel_ci_readonly WITH
  LOGIN
  PASSWORD 'CHANGE_ME'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  CONNECTION LIMIT 3
  VALID UNTIL '2027-01-31';

-- Reading every shop's rows (a backup must) needs RLS bypassed: without it the
-- role sees no rows of any table with row level security. If Supabase refuses
-- this statement, say so — the backup then cannot be complete with this role
-- (the check still works: it reads the schema and counts only where allowed).
ALTER ROLE wasel_ci_readonly BYPASSRLS;

-- Every session starts read-only and stops long queries
ALTER ROLE wasel_ci_readonly SET default_transaction_read_only = on;
ALTER ROLE wasel_ci_readonly SET statement_timeout = '10min';
ALTER ROLE wasel_ci_readonly SET idle_in_transaction_session_timeout = '15min';

GRANT CONNECT ON DATABASE postgres TO wasel_ci_readonly;

GRANT USAGE ON SCHEMA public TO wasel_ci_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO wasel_ci_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO wasel_ci_readonly;
-- tables the pending migrations add stay readable without re-running this
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO wasel_ci_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO wasel_ci_readonly;

-- the list of applied migrations
GRANT USAGE ON SCHEMA supabase_migrations TO wasel_ci_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA supabase_migrations TO wasel_ci_readonly;

-- -----------------------------------------------------------------------------
-- OPTIONAL — only if you decide the backup should include the sign-in accounts
-- (auth.users holds emails and password hashes) and the file records of
-- storage. Supabase may refuse these grants to `postgres`; if it does, the
-- backup covers the shop data only and says so.
-- -----------------------------------------------------------------------------
-- GRANT USAGE ON SCHEMA auth TO wasel_ci_readonly;
-- GRANT SELECT ON auth.users, auth.identities TO wasel_ci_readonly;
-- GRANT USAGE ON SCHEMA storage TO wasel_ci_readonly;
-- GRANT SELECT ON storage.buckets, storage.objects TO wasel_ci_readonly;

-- -----------------------------------------------------------------------------
-- Check what was granted (read only; expect: no super/createrole/createdb/
-- replication, bypassrls true, member of nothing)
-- -----------------------------------------------------------------------------
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
       rolconnlimit, rolvaliduntil, rolconfig,
       (SELECT count(*) FROM pg_auth_members m WHERE m.member = r.oid) AS member_of
  FROM pg_roles r WHERE rolname = 'wasel_ci_readonly';

-- =============================================================================
-- TO REVOKE IT (any time): delete the GitHub secret SUPABASE_DB_URL_RO, then run
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     REVOKE SELECT ON TABLES FROM wasel_ci_readonly;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     REVOKE SELECT ON SEQUENCES FROM wasel_ci_readonly;
--   DROP OWNED BY wasel_ci_readonly;   -- removes every grant it holds; it owns nothing
--   DROP ROLE wasel_ci_readonly;
--
-- Rotating the password: ALTER ROLE wasel_ci_readonly PASSWORD '…'; then update
-- the secret. The role also stops logging in by itself on VALID UNTIL.
-- =============================================================================
