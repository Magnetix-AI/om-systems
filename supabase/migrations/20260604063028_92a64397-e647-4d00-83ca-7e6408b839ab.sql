ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS arrival_time timestamptz,
  ADD COLUMN IF NOT EXISTS departure_time timestamptz;