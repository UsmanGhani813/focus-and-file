CREATE POLICY "Evidence of public sessions is viewable" ON storage.objects FOR SELECT
USING (
  bucket_id = 'work-evidence'
  AND EXISTS (
    SELECT 1 FROM public.attachments a
    JOIN public.work_sessions ws ON ws.id = a.work_session_id
    WHERE a.file_path = storage.objects.name AND ws.is_public = true
  )
);