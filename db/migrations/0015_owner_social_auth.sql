CREATE TABLE owner_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES owner_accounts(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('google','github')),
 issuer text NOT NULL,
 subject text NOT NULL,
 UNIQUE(provider,issuer,subject)
);
CREATE INDEX owner_identities_account ON owner_identities(account_id);
CREATE TABLE oauth_flows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 state_hash text NOT NULL UNIQUE,
 purpose text NOT NULL CHECK (purpose IN ('authorization','finish')),
 provider text NOT NULL CHECK (provider IN ('google','github')),
 account_id uuid REFERENCES owner_accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX oauth_flows_expiry ON oauth_flows(expires_at);
