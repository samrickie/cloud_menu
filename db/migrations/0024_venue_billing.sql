-- Negotiated venue pricing; existing accepted terms and payment records are preserved.
CREATE TABLE venue_billing_overrides (
 venue_id uuid PRIMARY KEY REFERENCES venues(id), enabled boolean NOT NULL DEFAULT true,
 monthly_fee_tzs bigint CHECK(monthly_fee_tzs BETWEEN 0 AND 1000000000),
 sales_fee_bp integer NOT NULL CHECK(sales_fee_bp BETWEEN 0 AND 10000),
 sales_basis text NOT NULL CHECK(sales_basis IN ('COLLECTED','ORDERED'))
);
CREATE TABLE venue_billing_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 sales_fee_bp integer NOT NULL CHECK(sales_fee_bp BETWEEN 0 AND 10000),
 sales_basis text NOT NULL CHECK(sales_basis IN ('COLLECTED','ORDERED'))
);
CREATE INDEX venue_billing_period_lookup ON venue_billing_periods(venue_id,ends_at);
