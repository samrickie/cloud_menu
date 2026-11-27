BEGIN;
CREATE TABLE owner_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email citext NOT NULL UNIQUE,
 full_name text NOT NULL,
 password_hash text NOT NULL,
 email_verified_at timestamptz,
 is_active boolean NOT NULL DEFAULT true,
 auth_version integer NOT NULL DEFAULT 1,
 failed_attempts integer NOT NULL DEFAULT 0,
 first_failure_at timestamptz,
 locked_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venues ADD COLUMN owner_account_id uuid REFERENCES owner_accounts(id);
ALTER TABLE staff_users ADD COLUMN owner_account_id uuid REFERENCES owner_accounts(id);
CREATE UNIQUE INDEX idx_owner_staff ON staff_users (venue_id,owner_account_id) WHERE owner_account_id IS NOT NULL;
CREATE INDEX idx_venues_owner ON venues(owner_account_id);
CREATE TABLE venue_profiles (
 venue_id uuid PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
 venue_type text NOT NULL CHECK (venue_type IN ('RESTAURANT','BAR','LOUNGE','CAFE','FAST_FOOD','HOTEL','CUSTOM')),
 theme text NOT NULL DEFAULT 'noir' CHECK (theme IN ('noir','ivory','bordeaux','sapphire','custom')),
 template text NOT NULL DEFAULT 'lounge' CHECK (template IN ('lounge','cafe','grill','minimal')),
 brand_colour text,
 primary_text text,
 languages text[] NOT NULL DEFAULT ARRAY['en','sw'],
 sections text[] NOT NULL DEFAULT ARRAY['Menu','Offers','Gallery','Reviews','Contact'],
 welcome_en text NOT NULL DEFAULT '',
 welcome_sw text NOT NULL DEFAULT '',
 hours jsonb NOT NULL DEFAULT '{}',
 logo_key text,
 cover_key text,
 is_published boolean NOT NULL DEFAULT false,
 is_sample boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_venue_profiles_updated BEFORE UPDATE ON venue_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMIT;
