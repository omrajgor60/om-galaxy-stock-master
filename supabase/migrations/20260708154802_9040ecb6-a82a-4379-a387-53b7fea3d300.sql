
CREATE TABLE public.master_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  ram TEXT,
  color TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_inventory TO authenticated;
GRANT ALL ON public.master_inventory TO service_role;

ALTER TABLE public.master_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view master inventory"
  ON public.master_inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can insert master inventory"
  ON public.master_inventory FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update master inventory"
  ON public.master_inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete master inventory"
  ON public.master_inventory FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_master_inventory_updated_at
  BEFORE UPDATE ON public.master_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
