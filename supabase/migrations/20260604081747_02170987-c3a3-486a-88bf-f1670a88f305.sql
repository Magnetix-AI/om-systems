
-- 1. Clients: restrict tech reads to assigned jobs/projects
DROP POLICY IF EXISTS clients_select_all ON public.clients;
CREATE POLICY clients_select_assigned ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.client_id = clients.id AND j.technician_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.client_id = clients.id AND p.technician_id = auth.uid())
);

-- 2. Profiles: only self + admin
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));

-- 3. Jobs: trigger prevents non-admin technicians from changing protected fields
CREATE OR REPLACE FUNCTION public.enforce_tech_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
     OR NEW.sent_to_invoicing IS DISTINCT FROM OLD.sent_to_invoicing
     OR NEW.sent_to_invoicing_at IS DISTINCT FROM OLD.sent_to_invoicing_at
  THEN
    RAISE EXCEPTION 'Technicians cannot modify protected job fields';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_tech_job_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_enforce_tech_update ON public.jobs;
CREATE TRIGGER jobs_enforce_tech_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tech_job_update();
