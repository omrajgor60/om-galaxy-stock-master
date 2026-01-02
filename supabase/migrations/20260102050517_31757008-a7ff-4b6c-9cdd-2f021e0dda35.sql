-- Create stock_transfers table for tracking inventory movements between outlets
CREATE TABLE public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_log_id UUID NOT NULL REFERENCES public.stock_logs(id),
  from_outlet_id UUID NOT NULL REFERENCES public.outlets(id),
  to_outlet_id UUID NOT NULL REFERENCES public.outlets(id),
  transferred_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view transfers
CREATE POLICY "All users can view transfers"
ON public.stock_transfers FOR SELECT
USING (true);

-- All users can insert transfers (for their own transfers)
CREATE POLICY "Users can insert transfers"
ON public.stock_transfers FOR INSERT
WITH CHECK (auth.uid() = transferred_by);

-- Only admins can delete transfers
CREATE POLICY "Admins can delete transfers"
ON public.stock_transfers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_stock_transfers_stock_log_id ON public.stock_transfers(stock_log_id);
CREATE INDEX idx_stock_transfers_from_outlet ON public.stock_transfers(from_outlet_id);
CREATE INDEX idx_stock_transfers_to_outlet ON public.stock_transfers(to_outlet_id);
CREATE INDEX idx_stock_transfers_created_at ON public.stock_transfers(created_at);