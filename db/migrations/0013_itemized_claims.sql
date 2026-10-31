BEGIN;
ALTER TABLE bill_splits ADD COLUMN subtotal_tzs bigint NOT NULL DEFAULT 0 CHECK(subtotal_tzs>=0);
ALTER TABLE bill_splits ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
-- Equal drafts created by the earlier API have no paid monetary attempts yet.
UPDATE bill_splits s SET subtotal_tzs=b.subtotal_tzs FROM bills b WHERE b.id=s.bill_id AND s.total_tzs=b.total_tzs;
CREATE UNIQUE INDEX uq_participant_session_scope ON session_participants(id,session_id);
ALTER TABLE bill_splits ADD CONSTRAINT fk_split_creator_scope FOREIGN KEY(created_by,session_id) REFERENCES session_participants(id,session_id);
ALTER TABLE bill_shares ADD CONSTRAINT fk_share_participant_scope FOREIGN KEY(participant_id,session_id) REFERENCES session_participants(id,session_id);
COMMIT;
