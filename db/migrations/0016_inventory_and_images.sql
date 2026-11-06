ALTER TABLE items ADD COLUMN track_stock boolean NOT NULL DEFAULT false,
 ADD COLUMN stock_quantity integer NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
 ADD COLUMN stock_revision integer NOT NULL DEFAULT 0 CHECK(stock_revision>=0),
 ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5 CHECK(low_stock_threshold>=0);
CREATE UNIQUE INDEX items_venue_identity ON items(id,venue_id);
CREATE TABLE inventory_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 item_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('COUNT','RECEIVE','WASTE','ORDER')),
 delta integer NOT NULL, remaining_quantity integer NOT NULL CHECK(remaining_quantity>=0),
 actor_id uuid REFERENCES staff_users(id), order_id uuid REFERENCES orders(id),
 client_adjustment_id uuid, request_hash text, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(item_id,venue_id) REFERENCES items(id,venue_id),
 UNIQUE(venue_id,client_adjustment_id), UNIQUE(order_id,item_id)
);
CREATE INDEX inventory_recent ON inventory_movements(venue_id,created_at DESC);
CREATE TABLE menu_images (
 venue_id uuid NOT NULL REFERENCES venues(id), image_key text NOT NULL,
 width integer NOT NULL CHECK(width IN (320,640,960)), content bytea NOT NULL CHECK(octet_length(content)<=2000000),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(venue_id,image_key,width)
);
