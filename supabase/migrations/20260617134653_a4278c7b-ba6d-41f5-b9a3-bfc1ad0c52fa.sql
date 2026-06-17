DROP POLICY IF EXISTS jobs_tech_update_assigned ON public.jobs;
CREATE POLICY jobs_tech_update_assigned ON public.jobs
  FOR UPDATE
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());