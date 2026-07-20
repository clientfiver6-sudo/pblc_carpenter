-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- BUSINESSES
create table businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in (
    'clinic','dental_clinic','aesthetic_clinic','veterinary_clinic',
    'plumber','electrician','bike_shop','auto_repair',
    'beauty_salon','retail_store','repair_shop','other_service_business'
  )),
  phone text,
  whatsapp_number text,
  address text,
  city text,
  state text,
  zip_code text,
  opening_hours jsonb default '{}',
  pix_key text,
  pix_key_type text,
  mercadopago_access_token text,
  whatsapp_token text,
  whatsapp_phone_id text,
  settings jsonb default '{}',
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BUSINESS USERS
create table business_users (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  created_at timestamptz default now(),
  unique(business_id, user_id)
);

-- CUSTOMERS
create table customers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  full_name text not null,
  phone_number text,
  email text,
  address text,
  city text,
  notes text,
  tags text[] default '{}',
  status text default 'active' check (status in ('active','inactive','blocked')),
  lead_status text default 'new' check (lead_status in (
    'new','contacted','quoted','scheduled','completed','lost'
  )),
  total_spent numeric(10,2) default 0,
  visit_count integer default 0,
  last_visit_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- STAFF
create table staff (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  working_hours jsonb default '{}',
  services text[] default '{}',
  color text default '#00e5a0',
  active boolean default true,
  created_at timestamptz default now()
);

-- SERVICES
create table services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer default 60,
  price numeric(10,2),
  price_max numeric(10,2),
  category text,
  active boolean default true,
  created_at timestamptz default now()
);

-- WORK ITEMS
create table work_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  assigned_staff_id uuid references staff(id) on delete set null,
  type text not null default 'appointment' check (type in (
    'appointment','job','repair','quote','order','consultation','service_call'
  )),
  title text not null,
  description text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  address text,
  status text not null default 'new' check (status in (
    'new','pending_confirmation','confirmed','in_progress',
    'waiting_customer','waiting_parts','completed','cancelled','no_show'
  )),
  price_estimate numeric(10,2),
  final_price numeric(10,2),
  payment_status text default 'unpaid' check (payment_status in (
    'unpaid','pending','paid','refunded'
  )),
  notes text,
  internal_notes text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CONVERSATIONS
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','manual')),
  status text default 'open' check (status in ('open','waiting','resolved','bot')),
  ai_active boolean default true,
  last_message_at timestamptz default now(),
  unread_count integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- MESSAGES
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  content text not null,
  message_type text default 'text' check (message_type in (
    'text','image','audio','document','template','system'
  )),
  whatsapp_message_id text,
  status text default 'sent' check (status in ('sending','sent','delivered','read','failed')),
  sent_by text,
  metadata jsonb default '{}',
  sent_at timestamptz default now()
);

-- AUTOMATIONS
create table automations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in (
    'booking_created','booking_confirmed','booking_24h_before',
    'booking_completed','booking_cancelled','booking_no_show',
    'payment_pending','payment_received',
    'lead_created','lead_inactive','customer_inactive'
  )),
  conditions jsonb default '{}',
  message_template text not null,
  delay_minutes integer default 0,
  active boolean default true,
  last_run_at timestamptz,
  run_count integer default 0,
  created_at timestamptz default now()
);

-- AUTOMATION LOGS
create table automation_logs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid references automations(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  work_item_id uuid references work_items(id) on delete set null,
  status text check (status in ('sent','failed','skipped')),
  message_sent text,
  error text,
  executed_at timestamptz default now()
);

-- PAYMENTS
create table payments (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  work_item_id uuid references work_items(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(10,2) not null,
  method text default 'pix' check (method in ('pix','cash','card','transfer')),
  status text default 'pending' check (status in ('pending','paid','failed','refunded','expired')),
  pix_link text,
  pix_qr_code text,
  pix_copy_paste text,
  mercadopago_payment_id text,
  mercadopago_preference_id text,
  description text,
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- BUSINESS FAQS
create table business_faqs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- INDEXES
create index idx_customers_business on customers(business_id);
create index idx_customers_phone on customers(phone_number);
create index idx_customers_name_trgm on customers using gin(full_name gin_trgm_ops);
create index idx_work_items_business on work_items(business_id);
create index idx_work_items_customer on work_items(customer_id);
create index idx_work_items_status on work_items(status);
create index idx_work_items_scheduled on work_items(scheduled_start);
create index idx_conversations_business on conversations(business_id);
create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_sent_at on messages(sent_at desc);
create index idx_payments_business on payments(business_id);
create index idx_payments_status on payments(status);

-- UPDATED_AT TRIGGER
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_businesses_updated before update on businesses
  for each row execute function update_updated_at();
create trigger trg_customers_updated before update on customers
  for each row execute function update_updated_at();
create trigger trg_work_items_updated before update on work_items
  for each row execute function update_updated_at();

-- RLS
alter table businesses enable row level security;
alter table business_users enable row level security;
alter table customers enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table work_items enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table automations enable row level security;
alter table automation_logs enable row level security;
alter table payments enable row level security;
alter table business_faqs enable row level security;

-- RLS HELPER
create or replace function get_my_business_id()
returns uuid as $$
  select business_id from business_users
  where user_id = auth.uid() limit 1;
$$ language sql security definer stable;

-- RLS POLICIES
create policy "users access own business data" on businesses
  for all using (id = get_my_business_id());
create policy "users access own business_users" on business_users
  for all using (business_id = get_my_business_id());
create policy "users access own customers" on customers
  for all using (business_id = get_my_business_id());
create policy "users access own staff" on staff
  for all using (business_id = get_my_business_id());
create policy "users access own services" on services
  for all using (business_id = get_my_business_id());
create policy "users access own work_items" on work_items
  for all using (business_id = get_my_business_id());
create policy "users access own conversations" on conversations
  for all using (business_id = get_my_business_id());
create policy "users access own messages" on messages
  for all using (business_id = get_my_business_id());
create policy "users access own automations" on automations
  for all using (business_id = get_my_business_id());
create policy "users access own automation_logs" on automation_logs
  for all using (business_id = get_my_business_id());
create policy "users access own payments" on payments
  for all using (business_id = get_my_business_id());
create policy "users access own faqs" on business_faqs
  for all using (business_id = get_my_business_id());

-- SERVICE ROLE BYPASS (for webhook/ai API routes)
create policy "service role bypass businesses" on businesses for all to service_role using (true);
create policy "service role bypass customers" on customers for all to service_role using (true);
create policy "service role bypass conversations" on conversations for all to service_role using (true);
create policy "service role bypass messages" on messages for all to service_role using (true);
create policy "service role bypass work_items" on work_items for all to service_role using (true);
create policy "service role bypass payments" on payments for all to service_role using (true);
create policy "service role bypass staff" on staff for all to service_role using (true);
create policy "service role bypass services" on services for all to service_role using (true);
create policy "service role bypass automations" on automations for all to service_role using (true);
create policy "service role bypass automation_logs" on automation_logs for all to service_role using (true);
create policy "service role bypass faqs" on business_faqs for all to service_role using (true);
