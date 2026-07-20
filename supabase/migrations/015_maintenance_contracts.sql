CREATE TABLE maintenance_contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  frequency text NOT NULL, -- monthly | quarterly | biannual | annual
  price numeric,
  next_due_at timestamptz NOT NULL,
  auto_schedule boolean DEFAULT true,
  auto_invoice boolean DEFAULT false,
  active boolean DEFAULT true,
  notes text,
  last_scheduled_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX maintenance_contracts_business_id_idx ON maintenance_contracts(business_id);
CREATE INDEX maintenance_contracts_next_due_idx ON maintenance_contracts(next_due_at) WHERE active = true;
