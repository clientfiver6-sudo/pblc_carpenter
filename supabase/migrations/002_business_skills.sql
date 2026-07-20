create table business_skills (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  content text not null,
  active boolean default true,
  order_index integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_business_skills_business on business_skills(business_id);
create trigger trg_business_skills_updated before update on business_skills
  for each row execute function update_updated_at();
alter table business_skills enable row level security;
create policy "users access own skills" on business_skills
  for all using (business_id = get_my_business_id());
create policy "service role bypass skills" on business_skills
  for all to service_role using (true);
