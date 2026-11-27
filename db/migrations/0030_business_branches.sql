CREATE TABLE businesses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_account_id uuid REFERENCES owner_accounts(id),
 name text NOT NULL,
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','INACTIVE','DELETED')),
 previous_state text CHECK(previous_state IN ('ACTIVE','INACTIVE')),
 deleted_at timestamptz, retain_until timestamptz,
 revision integer NOT NULL DEFAULT 0,
 changed_at timestamptz NOT NULL DEFAULT now(),
 changed_by uuid REFERENCES owner_accounts(id), reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venues ADD COLUMN business_id uuid REFERENCES businesses(id);
ALTER TABLE venues ADD COLUMN street text NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN area text NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN city text NOT NULL DEFAULT '';
-- Existing venue identity remains its branch identity; no QR or order IDs change.
INSERT INTO businesses(id,owner_account_id,name) SELECT id,owner_account_id,name FROM venues;
UPDATE venues SET business_id=id;
CREATE INDEX venues_business ON venues(business_id);
CREATE INDEX businesses_owner ON businesses(owner_account_id,state);
CREATE FUNCTION cloud_menu_default_business() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.business_id IS NULL THEN
  INSERT INTO businesses(id,owner_account_id,name) VALUES(NEW.id,NEW.owner_account_id,NEW.name);
  NEW.business_id:=NEW.id;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER default_business BEFORE INSERT ON venues FOR EACH ROW EXECUTE FUNCTION cloud_menu_default_business();
ALTER TABLE venues ALTER COLUMN business_id SET NOT NULL;
ALTER FUNCTION cloud_menu_venue_access(uuid,timestamptz) RENAME TO cloud_menu_subscription_access;
CREATE FUNCTION cloud_menu_venue_access(v uuid,at_time timestamptz DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE current_state text;
BEGIN
 SELECT b.state INTO current_state FROM businesses b JOIN venues ve ON ve.business_id=b.id WHERE ve.id=v FOR SHARE OF b;
 IF current_state IS DISTINCT FROM 'ACTIVE' THEN RETURN false; END IF;
 RETURN cloud_menu_subscription_access(v,at_time);
END; $$;
ALTER TABLE platform_admins DROP CONSTRAINT platform_admins_verification_method_check;
ALTER TABLE platform_admins ADD CONSTRAINT platform_admins_verification_method_check CHECK(verification_method IN ('VERIFIED_EMAIL','OPERATOR_BOUND','ADMIN_INVITE'));
CREATE TABLE account_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE NOT NULL,
 email citext NOT NULL, full_name text NOT NULL,
 role text NOT NULL CHECK(role IN ('OWNER','PLATFORM_ADMIN')),
 account_id uuid REFERENCES owner_accounts(id),
 created_by uuid NOT NULL REFERENCES owner_accounts(id),
 expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
