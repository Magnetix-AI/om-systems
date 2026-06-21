-- Remove client phone (per request: clients only have name + address)
ALTER TABLE public.clients DROP COLUMN IF EXISTS phone;

-- Add per-job "site contact" (איש קשר בשטח) with click-to-call phone
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS site_contact_name text,
  ADD COLUMN IF NOT EXISTS site_contact_phone text;