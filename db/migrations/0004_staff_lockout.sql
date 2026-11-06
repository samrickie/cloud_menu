BEGIN;
ALTER TABLE staff_users ADD COLUMN first_failure_at timestamptz;
COMMIT;
