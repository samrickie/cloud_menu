-- Frozen bill inputs for payment and receipt reconciliation; never live menu prices.
ALTER TABLE bill_splits ADD COLUMN lock_snapshot jsonb;
CREATE INDEX bill_splits_due_locks ON bill_splits(lock_expires_at,id) WHERE status='LOCKED';
