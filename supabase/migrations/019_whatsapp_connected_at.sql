ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamptz;
