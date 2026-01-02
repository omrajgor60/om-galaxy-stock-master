-- Create outlets table
CREATE TABLE public.outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view outlets
CREATE POLICY "All users can view outlets"
ON public.outlets FOR SELECT
USING (true);

-- Only admins can insert outlets
CREATE POLICY "Admins can insert outlets"
ON public.outlets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update outlets
CREATE POLICY "Admins can update outlets"
ON public.outlets FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete outlets
CREATE POLICY "Admins can delete outlets"
ON public.outlets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add outlet_id column to stock_logs
ALTER TABLE public.stock_logs ADD COLUMN outlet_id UUID REFERENCES public.outlets(id);

-- Create index for faster lookups
CREATE INDEX idx_stock_logs_outlet_id ON public.stock_logs(outlet_id);