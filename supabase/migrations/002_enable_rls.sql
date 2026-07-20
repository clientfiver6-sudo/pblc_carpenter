-- 002_enable_rls.sql
-- ---------------------------------------------------------------------------
-- Row-Level Security (RLS) — multi-tenant isolation.
--
-- Until now isolation rested entirely on app-code ownership checks. This adds a
-- database-level backstop so that, even if a route forgets to scope a query, a
-- logged-in user can only touch rows belonging to a business they are a member
-- of (via the business_users join table).
--
-- IMPORTANT: Supabase's service-role key BYPASSES RLS. All server-side privileged
-- paths use createAdminClient() (service role): the WhatsApp/Mercado Pago/Twilio
-- webhooks, the cron jobs, the AI receptionist, signup, and the /admin panel.
-- Those are therefore UNAFFECTED. These policies only constrain the user-scoped
-- (anon key + user JWT, role `authenticated`) client used by dashboard pages and
-- the user-facing API routes — which always operate on the caller's own business.
--
-- This migration is idempotent and defensive: it only touches a table if it
-- actually exists and (for the business_id set) actually has a business_id
-- column, so it is safe to run against a DB whose table set has drifted from the
-- committed migrations.
-- ---------------------------------------------------------------------------

-- 1. Tenant tables keyed by a direct `business_id` column.
do $$
declare
  t text;
  biz_tables text[] := array[
    -- from 001_initial_schema.sql
    'customers','staff','services','work_items','conversations','messages',
    'automations','automation_logs','payments','business_faqs',
    -- added later (notifications + feature work). Guarded by existence checks.
    'notifications','business_skills','equipment','webhook_endpoints',
    'ai_approvals','ai_usage_logs','briefing_cache','business_insights',
    'customer_memories','business_documents','subscriptions',
    'medical_notes','anamnese','prescriptions','exams','missed_calls'
  ];
begin
  foreach t in array biz_tables loop
    if to_regclass('public.' || t) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = 'business_id'
       )
    then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_tenant_isolation', t);
      execute format(
        'create policy %I on public.%I for all to authenticated '
        'using (business_id in (select business_id from public.business_users where user_id = auth.uid())) '
        'with check (business_id in (select business_id from public.business_users where user_id = auth.uid()))',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;

-- 2. businesses — keyed on `id` (compared against the caller's memberships).
do $$
begin
  if to_regclass('public.businesses') is not null then
    alter table public.businesses enable row level security;
    drop policy if exists businesses_tenant_isolation on public.businesses;
    create policy businesses_tenant_isolation on public.businesses for all to authenticated
      using (id in (select business_id from public.business_users where user_id = auth.uid()))
      with check (id in (select business_id from public.business_users where user_id = auth.uid()));
  end if;
end $$;

-- 3. business_users — a user may only see/manage their own membership rows.
--    (This policy references only auth.uid(), so it does not recurse with the
--     membership sub-selects used by the policies above.)
do $$
begin
  if to_regclass('public.business_users') is not null then
    alter table public.business_users enable row level security;
    drop policy if exists business_users_self on public.business_users;
    create policy business_users_self on public.business_users for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Rollback (manual): to disable, for each table run
--   alter table public.<t> disable row level security;
--   drop policy if exists <t>_tenant_isolation on public.<t>;
-- (and businesses_tenant_isolation / business_users_self for those two).
-- ---------------------------------------------------------------------------
