-- Audit log table for LGPD compliance and security monitoring
-- Records all sensitive operations: logins, data changes, exports, deletions

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,                    -- e.g. 'customer.created', 'payment.created', 'data.exported'
  resource_type text,                      -- e.g. 'customer', 'work_item', 'payment'
  resource_id uuid,
  old_values jsonb,                        -- previous state (for updates)
  new_values jsonb,                        -- new state (never store passwords/tokens)
  ip_address text,                         -- from x-forwarded-for header
  user_agent text,
  metadata jsonb DEFAULT '{}',             -- any extra context
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by business
CREATE INDEX IF NOT EXISTS audit_logs_business_id_idx ON audit_logs (business_id, created_at DESC);
-- Index for querying by user
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id, created_at DESC);
-- Index for querying by action type
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, created_at DESC);

-- RLS: enable it
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Business owners/managers can read their own audit logs
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT
  USING (
    business_id = (
      SELECT business_id FROM business_users
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Anyone can insert (service role inserts on behalf of users)
-- In practice, only the service role key should insert — enforce via API
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Nobody can update or delete audit logs (immutable)
-- No UPDATE or DELETE policies = those operations are blocked

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for LGPD compliance. Records sensitive operations.';
COMMENT ON COLUMN audit_logs.action IS 'Format: resource.verb — e.g. customer.created, data.exported, account.deleted';
COMMENT ON COLUMN audit_logs.old_values IS 'State before change. Never include passwords, tokens, or API keys.';
COMMENT ON COLUMN audit_logs.new_values IS 'State after change. Never include passwords, tokens, or API keys.';
