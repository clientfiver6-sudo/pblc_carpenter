-- Add compensation and payment fields to staff table
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS compensation_type text DEFAULT 'salary' CHECK (compensation_type IN ('salary', 'commission', 'other')),
  ADD COLUMN IF NOT EXISTS monthly_salary_cents integer,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS payment_day integer CHECK (payment_day >= 1 AND payment_day <= 31),
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reminder boolean NOT NULL DEFAULT false;
