CREATE TABLE IF NOT EXISTS customer_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  work_item_id uuid references work_items(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now()
);

ALTER TABLE customer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_members_attachments" ON customer_attachments
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM business_users WHERE user_id = auth.uid()
    )
  );
