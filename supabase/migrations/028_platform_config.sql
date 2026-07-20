-- Platform-level key/value config stored in DB (no env vars needed for admin-configurable secrets)
-- Accessible only via service_role (createAdminClient). No public policies intentionally.
CREATE TABLE IF NOT EXISTS platform_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
