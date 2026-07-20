-- Add 'scheduled' to work_items status check constraint
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_status_check;

ALTER TABLE work_items
  ADD CONSTRAINT work_items_status_check
  CHECK (status IN (
    'new','scheduled','pending_confirmation','confirmed','in_progress',
    'waiting_customer','waiting_parts','completed','cancelled','no_show'
  ));
