BEGIN;
ALTER TABLE orders ADD COLUMN request_hash text;
ALTER TABLE orders ADD COLUMN business_date date;
CREATE UNIQUE INDEX uq_order_daily_number ON orders(venue_id,business_date,order_no);
COMMIT;
