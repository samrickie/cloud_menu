BEGIN;
CREATE UNIQUE INDEX uq_session_tenant_scope ON table_sessions(id,venue_id);
ALTER TABLE bills ADD CONSTRAINT fk_bill_session_scope FOREIGN KEY(session_id,venue_id) REFERENCES table_sessions(id,venue_id);
CREATE UNIQUE INDEX uq_bill_tenant_scope ON bills(id,venue_id,session_id);

ALTER TABLE bill_splits ADD COLUMN venue_id uuid;
ALTER TABLE bill_splits ADD COLUMN session_id uuid;
UPDATE bill_splits s SET venue_id=b.venue_id,session_id=b.session_id FROM bills b WHERE b.id=s.bill_id;
ALTER TABLE bill_splits ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE bill_splits ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE bill_splits ADD CONSTRAINT fk_split_bill_scope FOREIGN KEY(bill_id,venue_id,session_id) REFERENCES bills(id,venue_id,session_id);
CREATE UNIQUE INDEX uq_split_tenant_scope ON bill_splits(id,venue_id,session_id);

ALTER TABLE bill_shares ADD COLUMN venue_id uuid;
ALTER TABLE bill_shares ADD COLUMN session_id uuid;
ALTER TABLE bill_shares ADD COLUMN slot_index integer;
UPDATE bill_shares s SET venue_id=p.venue_id,session_id=p.session_id FROM bill_splits p WHERE p.id=s.split_id;
WITH slots AS (SELECT id,(row_number() OVER(PARTITION BY split_id ORDER BY created_at,id)-1)::integer AS slot FROM bill_shares)
 UPDATE bill_shares s SET slot_index=x.slot FROM slots x WHERE s.id=x.id;
ALTER TABLE bill_shares ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE bill_shares ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE bill_shares ALTER COLUMN slot_index SET NOT NULL;
ALTER TABLE bill_shares ADD CONSTRAINT ck_share_slot CHECK(slot_index BETWEEN 0 AND 49);
ALTER TABLE bill_shares ADD CONSTRAINT fk_share_split_scope FOREIGN KEY(split_id,venue_id,session_id) REFERENCES bill_splits(id,venue_id,session_id);
CREATE UNIQUE INDEX uq_share_slot ON bill_shares(split_id,slot_index);
CREATE UNIQUE INDEX uq_share_tenant_scope ON bill_shares(id,venue_id,session_id);

ALTER TABLE bill_share_items ADD COLUMN venue_id uuid;
ALTER TABLE bill_share_items ADD COLUMN session_id uuid;
UPDATE bill_share_items i SET venue_id=s.venue_id,session_id=s.session_id FROM bill_shares s WHERE s.id=i.share_id;
ALTER TABLE bill_share_items ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE bill_share_items ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE bill_share_items ADD CONSTRAINT fk_share_item_scope FOREIGN KEY(share_id,venue_id,session_id) REFERENCES bill_shares(id,venue_id,session_id);
CREATE OR REPLACE FUNCTION check_share_item_tenant() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=NEW.order_item_id AND o.venue_id=NEW.venue_id AND o.session_id=NEW.session_id) THEN
  RAISE EXCEPTION 'VENUE_FORBIDDEN: allocation outside bill session' USING ERRCODE='23503';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_share_item_tenant BEFORE INSERT OR UPDATE ON bill_share_items FOR EACH ROW EXECUTE FUNCTION check_share_item_tenant();
COMMIT;
