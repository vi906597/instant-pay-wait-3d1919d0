
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS upi_ids text[] NOT NULL DEFAULT ARRAY['9065978244@upi']::text[];
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS assigned_upi text;
UPDATE public.payment_settings SET upi_ids = ARRAY[upi_id] WHERE array_length(upi_ids,1) IS NULL OR upi_ids = ARRAY[]::text[];
