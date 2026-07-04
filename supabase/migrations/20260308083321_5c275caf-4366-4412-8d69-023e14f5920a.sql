-- Allow authenticated users to insert merchants (needed during signup)
CREATE POLICY "Authenticated users can create merchants"
ON public.merchants
FOR INSERT
TO authenticated
WITH CHECK (true);