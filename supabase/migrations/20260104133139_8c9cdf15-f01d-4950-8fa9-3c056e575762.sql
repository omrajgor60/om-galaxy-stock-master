-- Add status column to stock_transfers for in-transit tracking
ALTER TABLE public.stock_transfers 
ADD COLUMN status text NOT NULL DEFAULT 'in_transit';

-- Add accepted_by and accepted_at columns
ALTER TABLE public.stock_transfers 
ADD COLUMN accepted_by uuid REFERENCES auth.users(id),
ADD COLUMN accepted_at timestamp with time zone;

-- Add commission column to sales for tracking finance company earnings
ALTER TABLE public.sales 
ADD COLUMN commission numeric DEFAULT 0;

-- Update RLS policies for stock_transfers to allow users to update (accept transfers)
CREATE POLICY "Users can update transfers to their outlet"
ON public.stock_transfers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.outlets o
    WHERE o.id = stock_transfers.to_outlet_id
  )
);

-- Create index for faster queries on status
CREATE INDEX idx_stock_transfers_status ON public.stock_transfers(status);