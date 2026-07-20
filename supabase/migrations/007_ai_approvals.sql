create table ai_approvals (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  tool_name text not null,
  tool_input jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  resolution_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index idx_ai_approvals_business on ai_approvals(business_id);
create index idx_ai_approvals_status on ai_approvals(status);
alter table ai_approvals enable row level security;
create policy "users access own ai_approvals" on ai_approvals
  for all using (business_id = get_my_business_id());
create policy "service role bypass ai_approvals" on ai_approvals
  for all to service_role using (true);
