BEGIN;
ALTER TABLE session_participants ADD COLUMN device_proof_hash text;
ALTER TABLE session_participants ADD COLUMN token_issued_at bigint;
COMMIT;
