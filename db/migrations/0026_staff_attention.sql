CREATE TABLE staff_attention_ack (
 staff_id uuid NOT NULL REFERENCES staff_users(id), venue_id uuid NOT NULL REFERENCES venues(id),
 kind text NOT NULL CHECK(kind IN ('ORDER','REQUEST')), entity_id uuid NOT NULL,
 station text NOT NULL CHECK(station IN ('KITCHEN','BAR','WAITER')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(staff_id,kind,entity_id,station)
);
CREATE TABLE staff_alert_preferences (
 staff_id uuid PRIMARY KEY REFERENCES staff_users(id), venue_id uuid NOT NULL REFERENCES venues(id),
 muted boolean NOT NULL DEFAULT true
);
CREATE INDEX service_open_items ON order_items(order_id,station) WHERE status NOT IN ('SERVED','REJECTED','CANCELLED');
