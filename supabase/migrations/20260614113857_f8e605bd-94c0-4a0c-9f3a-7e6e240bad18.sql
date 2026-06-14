CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_one_parent CHECK (
    (job_id IS NOT NULL)::int + (project_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX attachments_job_id_idx ON public.attachments(job_id);
CREATE INDEX attachments_project_id_idx ON public.attachments(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_admin_all" ON public.attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attachments_tech_select" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.technician_id = auth.uid()
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.technician_id = auth.uid()
    ))
  );