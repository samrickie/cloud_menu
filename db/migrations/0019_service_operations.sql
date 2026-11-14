ALTER TABLE order_items ADD COLUMN handled_by uuid REFERENCES staff_users(id), ADD COLUMN served_at timestamptz;
CREATE INDEX participant_order_history ON orders(venue_id,session_id,placed_by,created_at DESC);

CREATE TABLE service_feedback (
 order_id uuid PRIMARY KEY REFERENCES orders(id), venue_id uuid NOT NULL REFERENCES venues(id),
 waiter_rating smallint NOT NULL CHECK (waiter_rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (length(comment)<=500), food_ratings jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE items ADD COLUMN food_rating_count integer NOT NULL DEFAULT 0,
 ADD COLUMN food_rating_sum bigint NOT NULL DEFAULT 0;

CREATE TABLE venue_halls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 60), UNIQUE(venue_id,name)
);
INSERT INTO venue_halls(venue_id,name) SELECT DISTINCT venue_id,zone FROM dining_tables WHERE zone IS NOT NULL AND length(zone)>0;
