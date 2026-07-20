CREATE TABLE IF NOT EXISTS business_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  analyzed boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS business_documents_business_id_idx ON business_documents(business_id);

ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can manage documents"
  ON business_documents FOR ALL
  USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()));
