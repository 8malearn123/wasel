-- Rename subscription plans to Lite / Plus / Pro / Max
UPDATE public.plans SET name_ar = 'باقة لايت' WHERE name = 'Basic';
UPDATE public.plans SET name_ar = 'باقة بلس'  WHERE name = 'Professional';
UPDATE public.plans SET name_ar = 'باقة برو'  WHERE name = 'Enterprise';
UPDATE public.plans SET name_ar = 'باقة ماكس' WHERE name = 'Distributor';
