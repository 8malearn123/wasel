-- Rename subscription plans to metal-tier names
UPDATE public.plans SET name_ar = 'الباقة الفضية'     WHERE name = 'Basic';
UPDATE public.plans SET name_ar = 'الباقة الذهبية'    WHERE name = 'Professional';
UPDATE public.plans SET name_ar = 'الباقة البلاتينية' WHERE name = 'Enterprise';
