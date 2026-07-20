create table ai_reports (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  title text not null,
  prompt text not null,
  html_content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index idx_ai_reports_business on ai_reports(business_id);
create index idx_ai_reports_created on ai_reports(created_at desc);
alter table ai_reports enable row level security;
create policy "users access own ai_reports" on ai_reports
  for all using (business_id = get_my_business_id());
create policy "service role bypass ai_reports" on ai_reports
  for all to service_role using (true);
