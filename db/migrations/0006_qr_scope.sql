BEGIN;
ALTER TABLE dining_tables ADD COLUMN qr_format smallint NOT NULL DEFAULT 1 CHECK (qr_format IN (1,2));
COMMIT;
