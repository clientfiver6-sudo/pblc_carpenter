ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'starter'
    CHECK (subscription_plan IN ('starter', 'pro'));
