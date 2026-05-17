
-- Settings (single row)
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upi_id text NOT NULL DEFAULT '9065978244@upi',
  payee_name text NOT NULL DEFAULT 'ZYPEUS',
  qr_mode text NOT NULL DEFAULT 'auto',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (upi_id, payee_name, qr_mode)
VALUES ('9065978244@upi', 'ZYPEUS', 'auto');

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.payment_settings FOR SELECT
USING (true);

-- QR codes per amount
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL UNIQUE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read qr_codes"
ON public.qr_codes FOR SELECT
USING (true);

-- Payments: add user-submitted UTR
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS submitted_utr text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Allow anonymous insert (frontend creates orders directly now, no gateway)
CREATE POLICY "Anyone can create payments"
ON public.payments FOR INSERT
WITH CHECK (true);

-- Allow anonymous UTR submission on pending orders only
CREATE POLICY "Anyone can submit UTR on pending"
ON public.payments FOR UPDATE
USING (status = 'PENDING')
WITH CHECK (status = 'PENDING');

-- Storage bucket for QR images
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "QR images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'qr-codes');

CREATE POLICY "QR images public write"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qr-codes');

CREATE POLICY "QR images public update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qr-codes');

CREATE POLICY "QR images public delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'qr-codes');
