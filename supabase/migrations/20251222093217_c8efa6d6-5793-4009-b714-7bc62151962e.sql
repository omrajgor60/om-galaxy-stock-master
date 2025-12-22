
-- Rename brand to category and combine ram+storage into specs
ALTER TABLE public.products 
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS ram,
  DROP COLUMN IF EXISTS storage;

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS specs text;

-- Update the name column to allow null (will be auto-generated)
ALTER TABLE public.products ALTER COLUMN name DROP NOT NULL;
