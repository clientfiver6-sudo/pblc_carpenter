create table business_insights (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  insight_type text not null check (insight_type in (
    'weekly_narrative','monthly_summary','customer_pattern','revenue_trend'
  )),
  content text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz default now()
);
create index idx_business_insights_business on business_insights(business_id);
create index idx_business_insights_period on business_insights(period_end desc);
alter table business_insights enable row level security;
create policy "users access own business_insights" on business_insights
  for all using (business_id = get_my_business_id());
create policy "service role bypass business_insights" on business_insights
  for all to service_role using (true);
