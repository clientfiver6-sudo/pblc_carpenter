CREATE TABLE equipment (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  brand text,
  model text,
  serial_number text,
  installation_date date,
  location text,
  condition text DEFAULT 'good', -- good | fair | poor
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE work_item_equipment (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id uuid REFERENCES work_items(id) ON DELETE CASCADE NOT NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  notes text,
  condition_after text
);

CREATE INDEX equipment_business_customer_idx ON equipment(business_id, customer_id);
CREATE INDEX work_item_equipment_work_item_idx ON work_item_equipment(work_item_id);
