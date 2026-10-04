-- =============================================================================
-- Phase 0 · Security — rate limit the login-code endpoint
--
-- login-by-code takes a 5-digit numeric code and returns a full Supabase
-- session. 100,000 possible codes, no throttle, and the function runs with the
-- service role — a script could walk the whole space in minutes and sign in as
-- somebody's cashier. The function now records every attempt here and refuses
-- once a caller is over the limit.
--
-- The table is written only by the Edge Function (service role). No merchant
-- policy is added, so nothing in the app can read or forge attempts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.login_code_attempts (
  id          bigserial PRIMARY KEY,
  ip_hash     text,
  code_hash   text,
  succeeded   boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_code_attempts_ip_time_idx
  ON public.login_code_attempts (ip_hash, attempted_at DESC);

ALTER TABLE public.login_code_attempts ENABLE ROW LEVEL SECURITY;
-- no policies: service role only

DROP POLICY IF EXISTS "Platform admins read login attempts" ON public.login_code_attempts;
CREATE POLICY "Platform admins read login attempts"
  ON public.login_code_attempts FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Counts recent failures for a caller. Called by the Edge Function with the
-- service role; SECURITY DEFINER so it never depends on the caller's grants.
CREATE OR REPLACE FUNCTION public.login_code_recent_failures(_ip_hash text, _window_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.login_code_attempts
  WHERE ip_hash = _ip_hash
    AND succeeded = false
    AND attempted_at > now() - make_interval(mins => _window_minutes)
$$;

REVOKE ALL ON FUNCTION public.login_code_recent_failures(text, integer) FROM PUBLIC, anon, authenticated;

-- Housekeeping: attempts older than a day carry no signal.
CREATE OR REPLACE FUNCTION public.prune_login_code_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_code_attempts WHERE attempted_at < now() - interval '1 day'
$$;

REVOKE ALL ON FUNCTION public.prune_login_code_attempts() FROM PUBLIC, anon, authenticated;
