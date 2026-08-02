-- Add unique constraint to (business_id, phone_number) in customers table
-- to allow conflict resolution during webhook upserts.
ALTER TABLE customers 
ADD CONSTRAINT customers_business_id_phone_number_key UNIQUE (business_id, phone_number);
