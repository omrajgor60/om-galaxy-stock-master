
-- 1. Make user-tracking columns nullable
ALTER TABLE public.sales ALTER COLUMN sold_by DROP NOT NULL;
ALTER TABLE public.stock_logs ALTER COLUMN scanned_by DROP NOT NULL;
ALTER TABLE public.customers ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.stock_transfers ALTER COLUMN transferred_by DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN created_by DROP NOT NULL;

-- 2. Drop existing policies and rewrite as permissive for anon+authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('products','customers','sales','stock_logs','stock_transfers',
                               'outlets','master_inventory','profiles','user_roles',
                               'notifications','stock_alerts','issue_reports',
                               'time_off_requests','backups')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3. Grants for anon + authenticated
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','sales','stock_logs','stock_transfers',
                           'outlets','master_inventory','profiles','user_roles',
                           'notifications','stock_alerts','issue_reports',
                           'time_off_requests','backups']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "Public access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
