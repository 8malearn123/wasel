
-- Add login_code column to merchant_users
ALTER TABLE public.merchant_users ADD COLUMN IF NOT EXISTS login_code TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_merchant_users_login_code ON public.merchant_users(login_code) WHERE login_code IS NOT NULL AND is_active = true;
