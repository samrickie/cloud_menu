ALTER TABLE audit_log DROP CONSTRAINT audit_log_actor_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_type_check CHECK(actor_type IN ('STAFF','GUEST','SYSTEM','PROVIDER','PLATFORM_ADMIN'));
CREATE TABLE platform_admins (
 account_id uuid PRIMARY KEY REFERENCES owner_accounts(id), is_active boolean NOT NULL DEFAULT true,
 verification_method text NOT NULL CHECK(verification_method IN ('VERIFIED_EMAIL','OPERATOR_BOUND')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_settings (
 id text PRIMARY KEY CHECK(id='billing'), monthly_fee_tzs bigint CHECK(monthly_fee_tzs BETWEEN 0 AND 1000000000),
 sales_fee_bp integer NOT NULL DEFAULT 50 CHECK(sales_fee_bp BETWEEN 0 AND 10000),
 sales_basis text NOT NULL DEFAULT 'COLLECTED' CHECK(sales_basis IN ('COLLECTED','ORDERED')),
 default_trial_months integer NOT NULL DEFAULT 1 CHECK(default_trial_months BETWEEN 0 AND 12),
 grace_days integer NOT NULL DEFAULT 7 CHECK(grace_days BETWEEN 0 AND 90), revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES owner_accounts(id)
);
INSERT INTO platform_settings(id) VALUES('billing');
CREATE TABLE venue_access (
 venue_id uuid PRIMARY KEY REFERENCES venues(id), model text CHECK(model IN ('MONTHLY','SALES_BASED')),
 state text NOT NULL DEFAULT 'UNMANAGED' CHECK(state IN ('UNMANAGED','TRIAL','ACTIVE','EXPIRED','REVOKED')),
 pricing_version integer NOT NULL DEFAULT 0, monthly_fee_tzs bigint CHECK(monthly_fee_tzs BETWEEN 0 AND 1000000000),
 sales_fee_bp integer CHECK(sales_fee_bp BETWEEN 0 AND 10000), sales_basis text NOT NULL DEFAULT 'COLLECTED' CHECK(sales_basis IN ('COLLECTED','ORDERED')),
 trial_ends_at timestamptz, paid_until timestamptz, activated_at timestamptz, chosen_at timestamptz,
 grace_days integer NOT NULL DEFAULT 7 CHECK(grace_days BETWEEN 0 AND 90), revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(state<>'TRIAL' OR trial_ends_at IS NOT NULL),
 CHECK(state<>'ACTIVE' OR (model IS NOT NULL AND ((model='MONTHLY' AND paid_until IS NOT NULL AND monthly_fee_tzs IS NOT NULL) OR (model='SALES_BASED' AND sales_fee_bp IS NOT NULL))))
);
CREATE INDEX venue_trial_expiry ON venue_access(trial_ends_at) WHERE state='TRIAL';
CREATE INDEX venue_paid_expiry ON venue_access(paid_until) WHERE state='ACTIVE' AND model='MONTHLY';
CREATE TABLE subscription_actions (
 actor_account_id uuid NOT NULL REFERENCES owner_accounts(id), action_id uuid NOT NULL,
 venue_id uuid REFERENCES venues(id), request_hash text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_account_id,action_id)
);
CREATE INDEX subscription_audit_recent ON subscription_actions(venue_id,created_at DESC);
-- Called both before requests and under the existing venue transaction lock.
-- Expiration is committed by the request-time guard even if the API then denies access.
CREATE FUNCTION cloud_menu_venue_access(v uuid,at_time timestamptz DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE venue_state venue_status; entitlement venue_access%ROWTYPE; expired boolean; check_time timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('venue:'||v::text,0));
 -- now() is fixed at transaction start and can precede a long lock wait.
 check_time:=COALESCE(at_time,clock_timestamp());
 SELECT status INTO venue_state FROM venues WHERE id=v FOR UPDATE;
 IF NOT FOUND OR venue_state NOT IN ('ACTIVE','TRIAL') THEN RETURN false; END IF;
 SELECT * INTO entitlement FROM venue_access WHERE venue_id=v;
 IF NOT FOUND OR entitlement.state='UNMANAGED' THEN RETURN true; END IF;
 IF entitlement.state IN ('REVOKED','EXPIRED') THEN RETURN false; END IF;
 expired:=(entitlement.state='TRIAL' AND entitlement.trial_ends_at<=check_time) OR
 (entitlement.state='ACTIVE' AND entitlement.model='MONTHLY' AND entitlement.paid_until+entitlement.grace_days*interval '1 day'<=check_time);
 IF expired THEN
  UPDATE venues SET status='SUSPENDED' WHERE id=v;
  UPDATE venue_access SET state='EXPIRED',revision=revision+1,updated_at=check_time WHERE venue_id=v;
  INSERT INTO audit_log(venue_id,actor_type,action,entity_type,entity_id,data) VALUES(v,'SYSTEM','SUBSCRIPTION_EXPIRED','venue',v,'{}');
  INSERT INTO realtime_events(venue_id,event_type,payload) VALUES(v,'venue.access_suspended','{"status":"SUSPENDED"}');
  RETURN false;
 END IF;
 RETURN true;
END;
$$;
-- Keep the commerce boundary in the database as well as the API.
CREATE FUNCTION cloud_menu_order_access_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT cloud_menu_venue_access(NEW.venue_id) THEN
  RAISE EXCEPTION 'Venue access is suspended' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER order_access_guard BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION cloud_menu_order_access_guard();
