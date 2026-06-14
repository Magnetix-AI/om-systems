CREATE POLICY "attachments_admin_all_objects" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'attachments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attachments_tech_select_objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments' AND EXISTS (
      SELECT 1 FROM public.attachments a
      LEFT JOIN public.jobs j ON j.id = a.job_id
      LEFT JOIN public.projects p ON p.id = a.project_id
      WHERE a.storage_path = storage.objects.name
        AND (j.technician_id = auth.uid() OR p.technician_id = auth.uid())
    )
  );