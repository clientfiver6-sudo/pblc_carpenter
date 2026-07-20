-- Internal team messaging: owner/manager sends messages to a staff member
CREATE TABLE team_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id       uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  content        text NOT NULL,
  read           boolean NOT NULL DEFAULT false,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX team_messages_business_staff_idx
  ON team_messages (business_id, staff_id, created_at DESC);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business members can manage team messages"
  ON team_messages
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM business_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_users WHERE user_id = auth.uid()
    )
  );
