-- 034_whatsapp_ai_enabled.sql
-- Adds a business-level toggle for the WhatsApp AI receptionist.
-- Default false: opt-in model — existing businesses don't auto-enable AI.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_ai_enabled boolean NOT NULL DEFAULT false;
