BEGIN;
ALTER TABLE dining_tables ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
COMMIT;
