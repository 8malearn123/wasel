-- =============================================================================
-- Revoke one login code and sign its account out — run by hand, reviewed.
--
-- Where: Supabase → SQL Editor (runs as postgres), on the production project.
-- What it changes: one merchant_users row (login_code → NULL) and that user's
-- auth sessions. It does not delete or deactivate the account, and touches no
-- other row. Set the code once, in the first line of each step.
--
-- Run the steps one at a time and read each result before the next.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 · Preview (reads only). Expect exactly one row; stop if not.
-- ---------------------------------------------------------------------------
WITH c AS (SELECT '70035'::text AS code)
SELECT mu.id AS member_id, mu.user_id, mu.role, mu.is_active, m.name AS shop,
       (SELECT count(*) FROM auth.sessions s WHERE s.user_id = mu.user_id) AS sessions,
       (SELECT count(*) FROM public.merchant_users o
         WHERE o.user_id = mu.user_id AND o.id <> mu.id AND o.is_active) AS other_active_memberships
  FROM public.merchant_users mu
  JOIN public.merchants m ON m.id = mu.merchant_id
  JOIN c ON mu.login_code = c.code;

-- ---------------------------------------------------------------------------
-- STEP 2 · Revoke (one transaction). The old code is kept in ops_revoked_codes
-- for the rollback, readable by nobody but the database owner.
-- ---------------------------------------------------------------------------
BEGIN;
CREATE TABLE IF NOT EXISTS public.ops_revoked_codes (
  member_id  uuid PRIMARY KEY,
  user_id    uuid NOT NULL,
  login_code text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ops_revoked_codes ENABLE ROW LEVEL SECURITY;  -- no policy: no API access
REVOKE ALL ON public.ops_revoked_codes FROM anon, authenticated;

WITH c AS (SELECT '70035'::text AS code),
target AS (
  SELECT mu.id, mu.user_id, mu.login_code FROM public.merchant_users mu JOIN c ON mu.login_code = c.code
),
saved AS (
  INSERT INTO public.ops_revoked_codes (member_id, user_id, login_code)
  SELECT id, user_id, login_code FROM target
  ON CONFLICT (member_id) DO NOTHING
  RETURNING member_id
),
cleared AS (
  UPDATE public.merchant_users mu SET login_code = NULL, updated_at = now()
    FROM target WHERE mu.id = target.id
  RETURNING mu.user_id
)
DELETE FROM auth.sessions s USING cleared WHERE s.user_id = cleared.user_id;

-- must show 0 and 0 before COMMIT; otherwise ROLLBACK
SELECT (SELECT count(*) FROM public.merchant_users WHERE login_code = '70035') AS code_rows_left,
       (SELECT count(*) FROM auth.sessions s JOIN public.ops_revoked_codes r ON r.user_id = s.user_id
         WHERE r.login_code = '70035') AS sessions_left;
COMMIT;

-- ---------------------------------------------------------------------------
-- STEP 3 · Verify from outside (no SQL): POST /functions/v1/login-by-code with
-- {"code":"70035"} must answer 401 «كود الدخول غير صحيح», with no session.
-- The Wasel team runs this check and records the result.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ROLLBACK (only if the code must come back). Sessions are not restored:
-- the person signs in again.
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.merchant_users mu SET login_code = r.login_code, updated_at = now()
--   FROM public.ops_revoked_codes r
--  WHERE mu.id = r.member_id AND r.login_code = '70035' AND mu.login_code IS NULL;
-- DELETE FROM public.ops_revoked_codes WHERE login_code = '70035';
-- COMMIT;
