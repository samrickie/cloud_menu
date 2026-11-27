CREATE TABLE staff_notification_reads (
 staff_id uuid PRIMARY KEY REFERENCES staff_users(id), venue_id uuid NOT NULL REFERENCES venues(id),
 through_seq bigint NOT NULL DEFAULT 0 CHECK(through_seq>=0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_notification_events ON realtime_events(venue_id,created_at,seq)
 WHERE event_type IN ('order.created','order.status_changed','waiter.called');
