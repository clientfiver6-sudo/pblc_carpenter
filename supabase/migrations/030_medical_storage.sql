-- Create medical-audio storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-audio',
  'medical-audio',
  false,
  52428800,
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/webm;codecs=opus']
)
ON CONFLICT (id) DO NOTHING;

-- Business members can upload to their own business folder
CREATE POLICY "medical_audio_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'medical-audio'
  AND (storage.foldername(name))[1] IN (
    SELECT business_id::text FROM business_users WHERE user_id = auth.uid()
  )
);

-- Business members can read their own business folder
CREATE POLICY "medical_audio_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-audio'
  AND (storage.foldername(name))[1] IN (
    SELECT business_id::text FROM business_users WHERE user_id = auth.uid()
  )
);
