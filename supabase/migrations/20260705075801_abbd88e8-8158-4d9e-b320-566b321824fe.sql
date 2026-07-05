
CREATE POLICY attachments_tech_insert ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = attachments.job_id AND j.technician_id = auth.uid()))
  OR
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = attachments.project_id AND p.technician_id = auth.uid()))
);

CREATE POLICY attachments_tech_update ON public.attachments
FOR UPDATE TO authenticated
USING (
  (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = attachments.job_id AND j.technician_id = auth.uid()))
  OR
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = attachments.project_id AND p.technician_id = auth.uid()))
)
WITH CHECK (
  (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = attachments.job_id AND j.technician_id = auth.uid()))
  OR
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = attachments.project_id AND p.technician_id = auth.uid()))
);

CREATE POLICY attachments_tech_delete ON public.attachments
FOR DELETE TO authenticated
USING (
  (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = attachments.job_id AND j.technician_id = auth.uid()))
  OR
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = attachments.project_id AND p.technician_id = auth.uid()))
);

-- Storage policies: paths are jobs/{jobId}/... or projects/{projectId}/...
CREATE POLICY attachments_tech_insert_objects ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND (
    (split_part(name, '/', 1) = 'jobs' AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id::text = split_part(name, '/', 2) AND j.technician_id = auth.uid()
    ))
    OR
    (split_part(name, '/', 1) = 'projects' AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id::text = split_part(name, '/', 2) AND p.technician_id = auth.uid()
    ))
  )
);

CREATE POLICY attachments_tech_update_objects ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments' AND (
    (split_part(name, '/', 1) = 'jobs' AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id::text = split_part(name, '/', 2) AND j.technician_id = auth.uid()
    ))
    OR
    (split_part(name, '/', 1) = 'projects' AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id::text = split_part(name, '/', 2) AND p.technician_id = auth.uid()
    ))
  )
);

CREATE POLICY attachments_tech_delete_objects ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments' AND (
    (split_part(name, '/', 1) = 'jobs' AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id::text = split_part(name, '/', 2) AND j.technician_id = auth.uid()
    ))
    OR
    (split_part(name, '/', 1) = 'projects' AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id::text = split_part(name, '/', 2) AND p.technician_id = auth.uid()
    ))
  )
);
