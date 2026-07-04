DO $$
DECLARE
  plan_rec RECORD;
  v_user_id uuid;
  v_merchant_id uuid;
  v_email text;
  v_password text := 'demo1234';
  v_idx int := 0;
BEGIN
  FOR plan_rec IN SELECT id, name, name_ar FROM public.plans ORDER BY sort_order LOOP
    v_idx := v_idx + 1;
    v_email := 'demo-' || lower(plan_rec.name) || '@wasil.demo';

    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        v_email, crypt(v_password, gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'ديمو ' || plan_rec.name_ar),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email), 'email', v_user_id::text, now(), now(), now());
    ELSE
      UPDATE auth.users SET encrypted_password = crypt(v_password, gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (id, full_name) VALUES (v_user_id, 'ديمو ' || plan_rec.name_ar)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    SELECT merchant_id INTO v_merchant_id FROM public.merchant_users WHERE user_id = v_user_id LIMIT 1;
    IF v_merchant_id IS NULL THEN
      v_merchant_id := gen_random_uuid();
      INSERT INTO public.merchants (id, name, email, phone)
      VALUES (v_merchant_id, 'متجر ديمو - ' || plan_rec.name_ar, v_email, '0500000' || LPAD(v_idx::text, 3, '0'));
      INSERT INTO public.merchant_users (merchant_id, user_id, role, is_active)
      VALUES (v_merchant_id, v_user_id, 'owner', true);
      INSERT INTO public.branches (merchant_id, name, is_active)
      VALUES (v_merchant_id, 'الفرع الرئيسي', true);
    END IF;

    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE merchant_id = v_merchant_id) THEN
      UPDATE public.subscriptions SET plan = plan_rec.name, plan_id = plan_rec.id, status = 'active', subscription_ends_at = now() + interval '1 year' WHERE merchant_id = v_merchant_id;
    ELSE
      INSERT INTO public.subscriptions (merchant_id, plan, plan_id, status, subscription_ends_at)
      VALUES (v_merchant_id, plan_rec.name, plan_rec.id, 'active', now() + interval '1 year');
    END IF;
  END LOOP;
END $$;