CREATE TABLE venue_service_settings (
 venue_id uuid PRIMARY KEY REFERENCES venues(id),
 default_minutes integer NOT NULL DEFAULT 20 CHECK(default_minutes BETWEEN 1 AND 240),
 kitchen_minutes integer CHECK(kitchen_minutes BETWEEN 1 AND 240),
 bar_minutes integer CHECK(bar_minutes BETWEEN 1 AND 240),
 waiter_minutes integer CHECK(waiter_minutes BETWEEN 1 AND 240),
 business_day_cutoff text NOT NULL DEFAULT '00:00' CHECK(business_day_cutoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam' CHECK(timezone='Africa/Dar_es_Salaam'),
 revision integer NOT NULL DEFAULT 0
);
ALTER TABLE order_items ADD COLUMN stage_started_at timestamptz;
UPDATE order_items i SET stage_started_at=COALESCE(i.served_at,o.created_at) FROM orders o WHERE o.id=i.order_id;
ALTER TABLE order_items ALTER COLUMN stage_started_at SET DEFAULT now();
ALTER TABLE order_items ALTER COLUMN stage_started_at SET NOT NULL;
CREATE INDEX service_orders_day ON orders(venue_id,created_at DESC,id);
