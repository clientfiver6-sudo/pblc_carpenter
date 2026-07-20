-- Add "event" type to work_items for calendar-native events (team meetings, reminders, etc.)
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'work_items'::regclass AND contype = 'c' AND conname LIKE '%type%';
  IF c_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE work_items DROP CONSTRAINT ' || quote_ident(c_name);
  END IF;
END $$;

ALTER TABLE work_items ADD CONSTRAINT work_items_type_check
  CHECK (type IN ('appointment','job','repair','quote','order','consultation','service_call','event'));
