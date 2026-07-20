create table briefing_cache (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade not null,
  cache_key text not null,
  content text not null,
  cached_date date not null,
  created_at timestamptz default now(),
  unique(business_id, cache_key, cached_date)
);

create index idx_briefing_cache_lookup on briefing_cache(business_id, cache_key, cached_date);

alter table briefing_cache enable row level security;

create policy "service role bypass briefing_cache" on briefing_cache
  for all to service_role using (true);
