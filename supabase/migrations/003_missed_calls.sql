-- 003_missed_calls.sql
-- "Retorno de Ligações" (Call Returns): when a call to the business voice number
-- is missed/unanswered, record it and auto-send a WhatsApp follow-up.

-- Business-level configuration for the feature.
alter table businesses add column if not exists voice_number text;
alter table businesses add column if not exists call_return_enabled boolean not null default false;
alter table businesses add column if not exists call_return_template text;

create table if not exists missed_calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  call_sid text,
  from_number text not null,
  status text not null default 'missed',
  whatsapp_sent boolean not null default false,
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists missed_calls_business_created_idx
  on missed_calls (business_id, created_at desc);

-- Dedupe guard for Twilio status-callback retries (idempotency).
create unique index if not exists missed_calls_call_sid_idx
  on missed_calls (call_sid) where call_sid is not null;

-- RLS: same membership-based isolation as the rest of the schema (see 002).
-- Included here because missed_calls does not exist when 002 runs.
-- Service role (webhooks) bypasses RLS, so the Twilio handler still writes.
alter table missed_calls enable row level security;
drop policy if exists missed_calls_tenant_isolation on missed_calls;
create policy missed_calls_tenant_isolation on missed_calls for all to authenticated
  using (business_id in (select business_id from business_users where user_id = auth.uid()))
  with check (business_id in (select business_id from business_users where user_id = auth.uid()));
