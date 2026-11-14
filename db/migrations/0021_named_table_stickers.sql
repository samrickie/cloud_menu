ALTER TABLE dining_tables ADD COLUMN sticker_sequence integer;
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY venue_id ORDER BY created_at,id) AS n FROM dining_tables WHERE label !~ '[0-9]')
UPDATE dining_tables t SET sticker_sequence=99999+n.n FROM numbered n WHERE n.id=t.id;
CREATE UNIQUE INDEX dining_tables_named_sticker_number ON dining_tables(venue_id,sticker_sequence) WHERE sticker_sequence IS NOT NULL;
