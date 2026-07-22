
-- Reintroduce authentication-based access control
-- Revoke anon privileges and lock everything to authenticated users

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY['products','customers','sales','stock_logs','stock_transfers','outlets','master_inventory','profiles','user_roles','notifications','stock_alerts','issue_reports','time_off_requests','backups'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop all existing policies
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    -- Revoke anon
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Baseline: any authenticated user can read/write app data
-- Admin-gated tables get stricter policies below

-- Products, customers, sales, stock_logs, stock_transfers, master_inventory, outlets, notifications, stock_alerts, issue_reports, time_off_requests
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "auth all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all stock_logs" ON public.stock_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all stock_transfers" ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read master_inventory" ON public.master_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write master_inventory" ON public.master_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update master_inventory" ON public.master_inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete master_inventory" ON public.master_inventory FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "auth read outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write outlets" ON public.outlets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update outlets" ON public.outlets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete outlets" ON public.outlets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "system insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth all stock_alerts" ON public.stock_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all issue_reports" ON public.issue_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all time_off_requests" ON public.time_off_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles: users manage own; admins see all
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User roles: admins manage; users read own
CREATE POLICY "read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Backups: admin only
CREATE POLICY "admin all backups" ON public.backups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Ensure new signups get a profile (handle_new_user trigger + first-user-is-admin bootstrap)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bootstrap: first user becomes admin, subsequent users default to staff
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
