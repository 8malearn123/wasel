-- =====================================================================
-- TEST ONLY: minimal stand-ins for what a Supabase project provides, so
-- the migrations can run on a plain Postgres (CI service container or a
-- local docker postgres). Never run this against a real project.
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

-- auth.users with the columns the seed migrations write to
CREATE TABLE auth.users (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id            uuid,
    aud                    text,
    role                   text,
    email                  text,
    encrypted_password     text,
    email_confirmed_at     timestamptz,
    raw_app_meta_data      jsonb,
    raw_user_meta_data     jsonb DEFAULT '{}',
    confirmation_token     text,
    email_change           text,
    email_change_token_new text,
    recovery_token         text,
    created_at             timestamptz DEFAULT now(),
    updated_at             timestamptz
);
CREATE TABLE auth.identities (
    id uuid DEFAULT gen_random_uuid(), provider_id text, user_id uuid, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);

-- PostgREST puts the JWT claims in request.jwt.claim.*; the tests set them the same way.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT current_setting('request.jwt.claim.role', true) $$;

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array(name, '/') $$;

-- Supabase's default grants: API roles get table/function privileges, RLS decides rows.
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
