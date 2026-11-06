BEGIN;
CREATE TABLE waiter_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 venue_id uuid NOT NULL REFERENCES venues(id),
 session_id uuid NOT NULL REFERENCES table_sessions(id),
 table_id uuid NOT NULL REFERENCES dining_tables(id),
 participant_id uuid NOT NULL REFERENCES session_participants(id),
 reason text NOT NULL CHECK (reason IN ('HELP','BILL','CLEAN_TABLE','WATER')),
 message text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
 acknowledged_by uuid REFERENCES staff_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,
 resolved_at timestamptz
);
CREATE INDEX idx_calls_venue_status ON waiter_calls(venue_id,status,created_at DESC);
CREATE INDEX idx_calls_session_recent ON waiter_calls(session_id,created_at DESC);
COMMIT;
