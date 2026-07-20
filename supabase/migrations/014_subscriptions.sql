ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_subscription_payer_id text;
