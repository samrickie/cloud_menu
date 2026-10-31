BEGIN;
ALTER TABLE venues ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
UPDATE venues SET is_sample=true WHERE slug='cloud-menu-demo' AND name='Cloud-Menu DEMO Venue';
COMMIT;
