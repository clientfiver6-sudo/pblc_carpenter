-- Create storage bucket for business documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-documents',
  'business-documents',
  true,
  20971520,
  ARRAY['application/pdf','text/plain','text/csv','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Business members can upload to their own folder (folder name = business_id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business members can upload documents' AND tablename = 'objects') THEN
    CREATE POLICY "Business members can upload documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'business-documents' AND
        (storage.foldername(name))[1] IN (
          SELECT business_id::text FROM business_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Public read so file_url links work without auth
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for business documents' AND tablename = 'objects') THEN
    CREATE POLICY "Public read for business documents"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'business-documents');
  END IF;
END $$;

-- Business members can delete their own files
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business members can delete documents' AND tablename = 'objects') THEN
    CREATE POLICY "Business members can delete documents"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'business-documents' AND
        (storage.foldername(name))[1] IN (
          SELECT business_id::text FROM business_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
