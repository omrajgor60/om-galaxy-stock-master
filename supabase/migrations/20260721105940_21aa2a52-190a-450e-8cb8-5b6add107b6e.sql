
DROP POLICY IF EXISTS "All users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view own sales or admins view all" ON public.sales;
DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;

CREATE POLICY "Anyone can insert sales" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can view sales" ON public.sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update sales" ON public.sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete sales" ON public.sales FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO anon, authenticated;
