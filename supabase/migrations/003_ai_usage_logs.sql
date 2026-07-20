create table ai_usage_logs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  function_name text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd_cents integer not null default 0,
  conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz default now()
);
create index idx_ai_usage_logs_business on ai_usage_logs(business_id);
create index idx_ai_usage_logs_created on ai_usage_logs(created_at desc);
alter table ai_usage_logs enable row level security;
create policy "users access own ai_usage_logs" on ai_usage_logs
  for all using (business_id = get_my_business_id());
create policy "service role bypass ai_usage_logs" on ai_usage_logs
  for all to service_role using (true);
