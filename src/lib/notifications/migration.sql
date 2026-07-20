-- Run this migration in Supabase SQL editor to enable the notifications system.

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on notifications(business_id, read, created_at desc);

alter table notifications enable row level security;

create policy "business members can view their notifications"
  on notifications for all using (
    exists (
      select 1 from business_users
      where business_id = notifications.business_id
        and user_id = auth.uid()
    )
  );
