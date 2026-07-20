-- Add 'medical' plan tier
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_subscription_plan_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_subscription_plan_check
  CHECK (subscription_plan IN ('starter', 'pro', 'medical'));

-- Insurance columns on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS insurance_name        text,
  ADD COLUMN IF NOT EXISTS insurance_plan        text,
  ADD COLUMN IF NOT EXISTS insurance_card_number text;

-- Medical notes (SOAP consultation notes)
CREATE TABLE IF NOT EXISTS medical_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  work_item_id uuid        REFERENCES work_items(id) ON DELETE SET NULL,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  audio_url    text,
  transcript   text,
  subjective   text,
  objective    text,
  assessment   text,
  plan_text    text,
  raw_note     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Anamnese / patient intake forms (versioned — each visit inserts a new row)
CREATE TABLE IF NOT EXISTS anamnese (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id             uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  work_item_id            uuid        REFERENCES work_items(id) ON DELETE SET NULL,
  created_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  queixas_principais      text,
  historico_medico        text,
  alergias                text,
  medicamentos_em_uso     text,
  antecedentes_familiares text,
  habitos_vicios          text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  work_item_id uuid        REFERENCES work_items(id) ON DELETE SET NULL,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  crm_number   text,
  medications  jsonb       NOT NULL DEFAULT '[]',
  notes        text,
  issued_at    date        NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Exam requests (lab / imaging)
CREATE TABLE IF NOT EXISTS exam_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id            uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  work_item_id           uuid        REFERENCES work_items(id) ON DELETE SET NULL,
  created_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  exam_type              text        NOT NULL CHECK (exam_type IN ('laboratorial', 'imagem', 'outro')),
  exams_requested        jsonb       NOT NULL DEFAULT '[]',
  clinical_justification text,
  issued_at              date        NOT NULL DEFAULT CURRENT_DATE,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE medical_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnese        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_requests   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_notes_business_members" ON medical_notes
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "anamnese_business_members" ON anamnese
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "prescriptions_business_members" ON prescriptions
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "exam_requests_business_members" ON exam_requests
  FOR ALL USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));
