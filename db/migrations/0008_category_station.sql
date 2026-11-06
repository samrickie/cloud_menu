BEGIN;
ALTER TABLE categories ADD COLUMN default_station station_type NOT NULL DEFAULT 'KITCHEN';
COMMIT;
