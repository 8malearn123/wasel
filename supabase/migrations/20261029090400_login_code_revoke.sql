-- A login code dies with the account it opens.
--
-- Live: the code 70035 kept answering login-by-code with a full session
-- after the shop was done with that cashier. login-by-code accepts any code
-- on an active merchant_users row, and nothing ever cleared a code: turning
-- a member off left their code stored (switching them back on revived it),
-- and the sessions they already had stayed signed in until they expired.
--
-- Here, for every change made from now on:
-- * a member turned off (is_active true → false) loses their login code
-- * a member turned off or removed is signed out everywhere — their auth
--   sessions (and with them the refresh tokens) are deleted — unless they
--   still hold another active membership
-- * the RLS helpers already ignore inactive members (get_user_merchant_id
--   requires is_active), so an access token that has not expired yet reads
--   nothing of the shop in the meantime
-- Existing rows are not changed by this migration. Revoking one code that is
-- in use today is a separate, reviewed statement (docs/ops/revoke-login-code.sql).

CREATE OR REPLACE FUNCTION public.member_off_clears_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_active, true) AND NEW.is_active = false THEN
    NEW.login_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_users_off_clears_code ON public.merchant_users;
CREATE TRIGGER merchant_users_off_clears_code
  BEFORE UPDATE OF is_active ON public.merchant_users
  FOR EACH ROW EXECUTE FUNCTION public.member_off_clears_code();

CREATE OR REPLACE FUNCTION public.member_off_signs_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := OLD.user_id;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (COALESCE(OLD.is_active, true) AND NEW.is_active = false) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.merchant_users mu
              WHERE mu.user_id = _user AND mu.is_active = true AND mu.id <> OLD.id) THEN
    RETURN NULL;
  END IF;

  -- auth.sessions belongs to the auth service; if this database does not let
  -- the migration owner touch it, the member is still off (RLS) and the
  -- sessions run out on their own — say so rather than fail the change
  BEGIN
    DELETE FROM auth.sessions WHERE user_id = _user;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE WARNING 'member % is off but their sessions could not be revoked here', _user;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.member_off_signs_out() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS merchant_users_off_signs_out ON public.merchant_users;
CREATE TRIGGER merchant_users_off_signs_out
  AFTER UPDATE OF is_active OR DELETE ON public.merchant_users
  FOR EACH ROW EXECUTE FUNCTION public.member_off_signs_out();
