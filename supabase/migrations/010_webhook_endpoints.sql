create table webhook_endpoints (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  provider text not null,
  path_suffix text not null unique,
  secret text,
  event_map jsonb not null default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_webhook_endpoints_business on webhook_endpoints(business_id);
create index idx_webhook_endpoints_slug on webhook_endpoints(path_suffix);
create trigger trg_webhook_endpoints_updated before update on webhook_endpoints
  for each row execute function update_updated_at();
alter table webhook_endpoints enable row level security;
create policy "users access own webhook_endpoints" on webhook_endpoints
  for all using (business_id = get_my_business_id());
create policy "service role bypass webhook_endpoints" on webhook_endpoints
  for all to service_role using (true);
