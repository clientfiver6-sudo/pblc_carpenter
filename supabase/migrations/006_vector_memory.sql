create extension if not exists vector;

create table customer_memories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  memory_type text not null default 'conversation_summary'
    check (memory_type in ('conversation_summary','preference','complaint','note')),
  created_at timestamptz default now()
);
create index idx_customer_memories_customer on customer_memories(customer_id);
create index idx_customer_memories_embedding on customer_memories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table customer_memories enable row level security;
create policy "users access own customer_memories" on customer_memories
  for all using (business_id = get_my_business_id());
create policy "service role bypass customer_memories" on customer_memories
  for all to service_role using (true);

create or replace function match_customer_memories(
  query_embedding vector(1536),
  customer_id_filter uuid,
  match_count int default 5
) returns table (
  id uuid, content text, memory_type text, created_at timestamptz, similarity float
) language plpgsql as $$
begin
  return query
  select cm.id, cm.content, cm.memory_type, cm.created_at,
    1 - (cm.embedding <=> query_embedding) as similarity
  from customer_memories cm
  where cm.customer_id = customer_id_filter
  order by cm.embedding <=> query_embedding
  limit match_count;
end;
$$;
