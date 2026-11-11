CREATE TABLE platform_subscription_payments (
 id uuid PRIMARY KEY,
 venue_id uuid NOT NULL REFERENCES venues(id),
 amount_tzs bigint NOT NULL CHECK(amount_tzs>0 AND amount_tzs<=1000000000),
 paid_at timestamptz NOT NULL,
 next_due_at timestamptz NOT NULL CHECK(next_due_at>paid_at),
 reference text NOT NULL,
 recorded_by uuid NOT NULL REFERENCES owner_accounts(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_receipts_recent ON platform_subscription_payments(venue_id,paid_at DESC);
