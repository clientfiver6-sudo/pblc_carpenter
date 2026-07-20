-- Replace old business type constraint with the full set of supported types
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_type_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_type_check CHECK (type IN (
  -- HVAC / refrigeration
  'ac_residential', 'ac_commercial', 'refrigeration',
  -- Trades
  'electrician', 'plumber', 'locksmith',
  -- Other services
  'cleaning', 'pest_control',
  -- Generic fallback
  'other_service_business',
  -- Legacy types (kept for backwards compat with existing rows)
  'clinic', 'dental_clinic', 'aesthetic_clinic', 'veterinary_clinic',
  'bike_shop', 'auto_repair', 'beauty_salon', 'retail_store', 'repair_shop'
));

-- Subscription columns (idempotent — IF NOT EXISTS guards)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('active', 'trialing', 'cancelled', 'past_due')),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_subscription_payer_id text;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'starter'
    CHECK (subscription_plan IN ('starter', 'pro'));
