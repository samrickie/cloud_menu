BEGIN;
ALTER TABLE bills ADD COLUMN source_hash text NOT NULL DEFAULT '';
ALTER TABLE bills ADD COLUMN service_charge_bp integer NOT NULL DEFAULT 0 CHECK (service_charge_bp BETWEEN 0 AND 10000);
ALTER TABLE bills ADD COLUMN vat_rate_bp integer NOT NULL DEFAULT 1800 CHECK (vat_rate_bp BETWEEN 0 AND 10000);
ALTER TABLE bills ADD COLUMN prices_include_vat boolean NOT NULL DEFAULT true;
UPDATE bills b SET service_charge_bp=v.service_charge_bp,vat_rate_bp=v.vat_rate_bp,prices_include_vat=v.prices_include_vat FROM venues v WHERE v.id=b.venue_id;
COMMIT;
