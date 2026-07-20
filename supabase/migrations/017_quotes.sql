CREATE TABLE quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  valid_until date,
  status text NOT NULL DEFAULT 'draft', -- draft | sent | approved | rejected | expired
  approval_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  approved_at timestamptz,
  rejected_at timestamptz,
  work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX quotes_business_id_idx ON quotes(business_id);
CREATE INDEX quotes_approval_token_idx ON quotes(approval_token);
CREATE INDEX quotes_customer_id_idx ON quotes(customer_id);
