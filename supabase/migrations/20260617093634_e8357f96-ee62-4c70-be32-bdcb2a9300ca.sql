
-- 1. Add color column to profiles for technician color-coding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color text;

-- 2. Add start/end time and draft data for jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS draft_quantities jsonb;

-- 3. Allow enforce_tech_job_update trigger to permit techs editing draft_quantities/arrival/notes etc.
-- The existing trigger restricts technician_id, client_id, title, description, scheduled_date, sent_to_invoicing.
-- draft_quantities, arrival_time, departure_time, technician_notes, status are still editable by technician.
-- No change needed for trigger - it permits draft_quantities by default.

-- 4. Disable public sign-ups: handled in auth UI; we also restrict the handle_new_user trigger.
-- The trigger remains; admins create users via Auth Admin API which still fires it (assigns 'technician' role).
-- This is fine because the admin sets a color/name afterward.
