
-- Profiles: restrict SELECT
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Sales: restrict SELECT
DROP POLICY IF EXISTS "All users can view sales" ON public.sales;
CREATE POLICY "Users can view own sales or admins view all"
ON public.sales FOR SELECT
TO authenticated
USING (auth.uid() = sold_by OR public.has_role(auth.uid(), 'admin'));

-- Notifications: remove permissive insert (SECURITY DEFINER triggers bypass RLS)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Stock alerts: remove permissive insert (SECURITY DEFINER triggers bypass RLS)
DROP POLICY IF EXISTS "System can insert stock alerts" ON public.stock_alerts;
CREATE POLICY "Admins can insert stock alerts"
ON public.stock_alerts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
