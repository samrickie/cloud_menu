-- =====================================================================
-- Cloud-Menu: PostgreSQL 15+ schema (v0.1, pre-development draft)
-- Money: whole Tanzanian shillings stored as BIGINT (TZS has no minor unit in practice).
-- Rates (VAT, service charge) are stored in basis points (1800 = 18.00%).
-- Verify VAT/service-charge/fiscal-receipt rules with a tax adviser before launch.
-- All timestamps are timestamptz (UTC); venue timezone is Africa/Dar_es_Salaam.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt()

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE venue_status        AS ENUM ('TRIAL','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE staff_role          AS ENUM ('WAITER','KITCHEN','BAR','MANAGER','OWNER');
CREATE TYPE station_type        AS ENUM ('KITCHEN','BAR');
CREATE TYPE selection_type      AS ENUM ('SINGLE','MULTI');
CREATE TYPE session_status      AS ENUM ('ACTIVE','CLOSED');
CREATE TYPE order_status        AS ENUM ('NEW','ACCEPTED','PREPARING','READY','SERVED','CANCELLED');
CREATE TYPE order_item_status   AS ENUM ('NEW','ACCEPTED','PREPARING','READY','SERVED','REJECTED','CANCELLED');
CREATE TYPE bill_status         AS ENUM ('OPEN','LOCKED','SETTLED','VOID');
CREATE TYPE split_mode          AS ENUM ('EQUAL','ITEMIZED');
CREATE TYPE split_status        AS ENUM ('OPEN','LOCKED','SETTLED','EXPIRED','CANCELLED');
CREATE TYPE share_status        AS ENUM ('UNPAID','PENDING','PAID','VOID');
CREATE TYPE payment_provider    AS ENUM ('MPESA','TIGOPESA','AIRTELMONEY','CASH');
CREATE TYPE payment_status      AS ENUM ('INITIATED','PENDING','SUCCESS','FAILED','CANCELLED','EXPIRED');
CREATE TYPE webhook_status      AS ENUM ('RECEIVED','PROCESSED','IGNORED_DUPLICATE','REJECTED','ERROR');

-- ---------------------------------------------------------------------
-- COMMON: updated_at trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- TENANCY: VENUES, SUBSCRIPTIONS, STAFF
-- ---------------------------------------------------------------------
CREATE TABLE venues (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                citext NOT NULL UNIQUE,
  name                text NOT NULL,
  status              venue_status NOT NULL DEFAULT 'TRIAL',
  timezone            text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  currency            char(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  vat_rate_bp         integer NOT NULL DEFAULT 1800 CHECK (vat_rate_bp BETWEEN 0 AND 10000),
  prices_include_vat  boolean NOT NULL DEFAULT true,
  service_charge_bp   integer NOT NULL DEFAULT 0 CHECK (service_charge_bp BETWEEN 0 AND 10000),
  tin                 text,                          -- tax identification number (as given by venue)
  phone               text,
  address             text,
  idle_timeout_min    integer NOT NULL DEFAULT 90 CHECK (idle_timeout_min > 0),
  max_participants    integer NOT NULL DEFAULT 20 CHECK (max_participants > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_venues_updated BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  plan_code            text NOT NULL,
  monthly_fee_tzs      bigint NOT NULL CHECK (monthly_fee_tzs >= 0),
  current_period_start date NOT NULL,
  current_period_end   date NOT NULL,
  grace_days           integer NOT NULL DEFAULT 7,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end > current_period_start)
);
CREATE INDEX idx_subscriptions_venue ON subscriptions (venue_id, is_active);

CREATE TABLE staff_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  full_name        text NOT NULL,
  role             staff_role NOT NULL,
  pin_hash         text NOT NULL,                    -- bcrypt/argon2 hash, never the PIN
  is_active        boolean NOT NULL DEFAULT true,
  failed_attempts  integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_venue ON staff_users (venue_id) WHERE is_active;
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- TABLES (physical) AND QR CODES
-- ---------------------------------------------------------------------
CREATE TABLE dining_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  label           text NOT NULL,                     -- "T12", "VIP 2", "Terrace 5"
  zone            text,
  seats           integer CHECK (seats > 0),
  qr_code         text NOT NULL UNIQUE,              -- public short code embedded in QR URL
  qr_key_version  integer NOT NULL DEFAULT 1,        -- bump to invalidate printed QR (HMAC key version)
  qr_rotated_at   timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, label)
);

-- ---------------------------------------------------------------------
-- MENU: MENUS, CATEGORIES, ITEMS, MODIFIERS
-- ---------------------------------------------------------------------
CREATE TABLE menus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  version     integer NOT NULL DEFAULT 1,            -- bump on change; used for ETag/cache busting
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menus_venue ON menus (venue_id) WHERE is_active;
CREATE TRIGGER trg_menus_updated BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id     uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name_en     text NOT NULL,
  name_sw     text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_categories_menu ON categories (menu_id, sort_order);

CREATE TABLE items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  category_id     uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name_en         text NOT NULL,
  name_sw         text,
  description_en  text,
  description_sw  text,
  price_tzs       bigint NOT NULL CHECK (price_tzs >= 0),
  image_key       text,                               -- object storage key; variants generated per width
  station         station_type NOT NULL DEFAULT 'KITCHEN',
  prep_time_min   integer CHECK (prep_time_min >= 0),
  is_available    boolean NOT NULL DEFAULT true,      -- "sold out" toggle (real-time)
  is_active       boolean NOT NULL DEFAULT true,      -- soft delete / hidden
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_category ON items (category_id, sort_order) WHERE is_active;
CREATE INDEX idx_items_venue ON items (venue_id) WHERE is_active;
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE modifier_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name_en         text NOT NULL,                      -- "Mixer", "Spice level", "Extras"
  name_sw         text,
  selection       selection_type NOT NULL DEFAULT 'SINGLE',
  min_select      integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select      integer NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  CHECK (max_select >= min_select),
  CHECK (selection = 'MULTI' OR max_select = 1)
);

CREATE TABLE modifiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name_en          text NOT NULL,                     -- "Coke", "Hot", "Double shot"
  name_sw          text,
  price_delta_tzs  bigint NOT NULL DEFAULT 0,
  is_available     boolean NOT NULL DEFAULT true,
  is_default       boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_modifiers_group ON modifiers (group_id, sort_order);

CREATE TABLE item_modifier_groups (
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, group_id)
);

-- ---------------------------------------------------------------------
-- TABLE SESSIONS AND PARTICIPANTS (no sign-up)
-- ---------------------------------------------------------------------
CREATE TABLE table_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  table_id          uuid NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
  status            session_status NOT NULL DEFAULT 'ACTIVE',
  opened_at         timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz,
  closed_reason     text,                              -- PAID, IDLE_TIMEOUT, WAITER_CLOSED, MOVED
  closed_by_staff   uuid REFERENCES staff_users(id),
  CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL))
);
-- At most one ACTIVE session per physical table
CREATE UNIQUE INDEX uq_one_active_session_per_table ON table_sessions (table_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_sessions_venue_active ON table_sessions (venue_id, status, last_activity_at);

CREATE TABLE session_participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  device_hash   text NOT NULL,                         -- hash of random device id from the PWA (not a fingerprint)
  user_agent    text,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, device_hash)
);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  placed_by           uuid REFERENCES session_participants(id) ON DELETE SET NULL,
  placed_by_staff     uuid REFERENCES staff_users(id),
  order_no            integer NOT NULL,                -- human-friendly per venue per business day
  client_order_id     text NOT NULL,                   -- idempotency token from the PWA
  status              order_status NOT NULL DEFAULT 'NEW',
  subtotal_tzs        bigint NOT NULL DEFAULT 0 CHECK (subtotal_tzs >= 0),
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, client_order_id)
);
CREATE INDEX idx_orders_venue_status ON orders (venue_id, status, created_at DESC);
CREATE INDEX idx_orders_session ON orders (session_id, created_at);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id               uuid REFERENCES items(id) ON DELETE SET NULL,
  participant_id        uuid REFERENCES session_participants(id) ON DELETE SET NULL,  -- who ordered it
  name_snapshot         text NOT NULL,                 -- history survives menu edits
  unit_price_tzs        bigint NOT NULL CHECK (unit_price_tzs >= 0),
  modifiers_total_tzs   bigint NOT NULL DEFAULT 0,
  quantity              integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total_tzs        bigint NOT NULL CHECK (line_total_tzs >= 0),
  note                  text,
  station               station_type NOT NULL,
  status                order_item_status NOT NULL DEFAULT 'NEW',
  reject_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (line_total_tzs = (unit_price_tzs + modifiers_total_tzs) * quantity),
  CHECK (status <> 'REJECTED' OR reject_reason IS NOT NULL)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_station ON order_items (station, status) WHERE status IN ('NEW','ACCEPTED','PREPARING','READY');
CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_item_modifiers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id       uuid REFERENCES modifiers(id) ON DELETE SET NULL,
  name_snapshot     text NOT NULL,
  price_delta_tzs   bigint NOT NULL DEFAULT 0
);
CREATE INDEX idx_oim_item ON order_item_modifiers (order_item_id);

-- Append-only event log: powers real-time fan-out and "events since seq" resync after disconnects.
-- Consider monthly partitioning and a 30-day retention job.
CREATE TABLE realtime_events (
  seq          bigserial PRIMARY KEY,
  venue_id     uuid NOT NULL,
  session_id   uuid,
  event_type   text NOT NULL,                          -- order.created, order.status_changed, payment.updated, ...
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_events_venue_seq ON realtime_events (venue_id, seq);
CREATE INDEX idx_rt_events_session_seq ON realtime_events (session_id, seq) WHERE session_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- BILLS AND SPLITS
-- ---------------------------------------------------------------------
CREATE TABLE bills (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL UNIQUE REFERENCES table_sessions(id) ON DELETE CASCADE,
  venue_id             uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  subtotal_tzs         bigint NOT NULL DEFAULT 0 CHECK (subtotal_tzs >= 0),
  service_charge_tzs   bigint NOT NULL DEFAULT 0 CHECK (service_charge_tzs >= 0),
  tax_tzs              bigint NOT NULL DEFAULT 0 CHECK (tax_tzs >= 0),
  total_tzs            bigint NOT NULL DEFAULT 0 CHECK (total_tzs >= 0),
  paid_tzs             bigint NOT NULL DEFAULT 0 CHECK (paid_tzs >= 0),
  status               bill_status NOT NULL DEFAULT 'OPEN',
  version              integer NOT NULL DEFAULT 1,      -- optimistic locking; bump on every recalculation
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_tzs <= total_tzs)
);
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bill_splits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id               uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  mode                  split_mode NOT NULL,
  status                split_status NOT NULL DEFAULT 'OPEN',
  payer_count           integer NOT NULL CHECK (payer_count BETWEEN 1 AND 50),
  bill_version          integer NOT NULL,               -- bill version this split was computed against
  total_tzs             bigint NOT NULL CHECK (total_tzs >= 0),
  created_by            uuid REFERENCES session_participants(id) ON DELETE SET NULL,
  locked_at             timestamptz,
  lock_expires_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'LOCKED' OR (locked_at IS NOT NULL AND lock_expires_at IS NOT NULL))
);
-- Only one OPEN or LOCKED split per bill at a time
CREATE UNIQUE INDEX uq_one_live_split_per_bill ON bill_splits (bill_id) WHERE status IN ('OPEN','LOCKED');
CREATE INDEX idx_splits_lock_expiry ON bill_splits (lock_expires_at) WHERE status = 'LOCKED';
CREATE TRIGGER trg_splits_updated BEFORE UPDATE ON bill_splits FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bill_shares (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id         uuid NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  participant_id   uuid REFERENCES session_participants(id) ON DELETE SET NULL,  -- NULL for equal-split slots until claimed
  label            text NOT NULL,                        -- "Guest 2", "Neema"
  amount_tzs       bigint NOT NULL CHECK (amount_tzs >= 0),   -- includes proportional service charge and tax
  tip_tzs          bigint NOT NULL DEFAULT 0 CHECK (tip_tzs >= 0),
  status           share_status NOT NULL DEFAULT 'UNPAID',
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shares_split ON bill_shares (split_id);
CREATE TRIGGER trg_shares_updated BEFORE UPDATE ON bill_shares FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itemized mode: which order items (or fractions of them, in TZS) each share carries.
CREATE TABLE bill_share_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id        uuid NOT NULL REFERENCES bill_shares(id) ON DELETE CASCADE,
  order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  amount_tzs      bigint NOT NULL CHECK (amount_tzs > 0),   -- item amount allocated (excl. service/tax)
  UNIQUE (share_id, order_item_id)
);
CREATE INDEX idx_share_items_item ON bill_share_items (order_item_id);

-- Guard: allocations for one order item within a split must not exceed the line total.
-- NOTE: the application must hold a row lock on bill_splits (SELECT ... FOR UPDATE) while
-- changing allocations, otherwise two concurrent inserts could both pass this check.
CREATE OR REPLACE FUNCTION check_item_allocation() RETURNS trigger AS $$
DECLARE
  v_split     uuid;
  v_line      bigint;
  v_allocated bigint;
BEGIN
  SELECT split_id INTO v_split FROM bill_shares WHERE id = NEW.share_id;
  SELECT line_total_tzs INTO v_line FROM order_items WHERE id = NEW.order_item_id;
  SELECT COALESCE(SUM(si.amount_tzs), 0) INTO v_allocated
    FROM bill_share_items si
    JOIN bill_shares s ON s.id = si.share_id
   WHERE s.split_id = v_split AND si.order_item_id = NEW.order_item_id AND si.id <> NEW.id;
  IF v_allocated + NEW.amount_tzs > v_line THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED: allocation exceeds line total for order_item %', NEW.order_item_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_item_allocation BEFORE INSERT OR UPDATE ON bill_share_items
  FOR EACH ROW EXECUTE FUNCTION check_item_allocation();

-- ---------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------
CREATE TABLE payment_transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  share_id             uuid NOT NULL REFERENCES bill_shares(id) ON DELETE RESTRICT,
  attempt_no           integer NOT NULL DEFAULT 1,
  provider             payment_provider NOT NULL,
  msisdn_enc           bytea,                            -- application-level encrypted phone number
  msisdn_last4         char(4),
  amount_tzs           bigint NOT NULL CHECK (amount_tzs > 0),
  status               payment_status NOT NULL DEFAULT 'INITIATED',
  idempotency_key      text NOT NULL UNIQUE,
  our_reference        text NOT NULL UNIQUE,             -- reference we send to the aggregator
  provider_reference   text,                             -- aggregator / network transaction id
  failure_code         text,
  failure_message      text,
  initiated_at         timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,
  completed_at         timestamptz,
  last_polled_at       timestamptz,
  poll_count           integer NOT NULL DEFAULT 0,
  needs_review         boolean NOT NULL DEFAULT false,   -- e.g. late success after local expiry
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (provider <> 'CASH' OR msisdn_enc IS NULL),
  UNIQUE (share_id, attempt_no)
);
-- A share can have at most one in-flight attempt and at most one success
CREATE UNIQUE INDEX uq_share_one_inflight ON payment_transactions (share_id) WHERE status IN ('INITIATED','PENDING');
CREATE UNIQUE INDEX uq_share_one_success  ON payment_transactions (share_id) WHERE status = 'SUCCESS';
CREATE INDEX idx_pay_reconcile ON payment_transactions (last_polled_at NULLS FIRST) WHERE status IN ('INITIATED','PENDING');
CREATE INDEX idx_pay_provider_ref ON payment_transactions (provider, provider_reference);
CREATE INDEX idx_pay_venue_created ON payment_transactions (venue_id, created_at DESC);
CREATE TRIGGER trg_pay_updated BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Raw inbound callbacks: store first, process after; dedupe by provider event id.
CREATE TABLE payment_webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  event_id          text NOT NULL,                        -- provider event/transaction id used for dedupe
  signature_valid   boolean NOT NULL,
  source_ip         inet,
  headers           jsonb,
  payload           jsonb NOT NULL,
  transaction_id    uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  status            webhook_status NOT NULL DEFAULT 'RECEIVED',
  error             text,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  UNIQUE (provider, event_id)
);
CREATE INDEX idx_webhooks_unprocessed ON payment_webhook_events (received_at) WHERE status IN ('RECEIVED','ERROR');

CREATE TABLE receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id       uuid NOT NULL UNIQUE REFERENCES bill_shares(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  public_token   text NOT NULL UNIQUE,                    -- unguessable link token
  receipt_no     text NOT NULL,
  payload        jsonb NOT NULL,                          -- snapshot: venue, items, amounts, references
  issued_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- PLATFORM SUPPORT: IDEMPOTENCY AND AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  key            text NOT NULL,
  scope          text NOT NULL,                           -- e.g. "orders:create:<session_id>"
  request_hash   text NOT NULL,
  response_code  integer,
  response_body  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (scope, key)
);
CREATE INDEX idx_idem_expiry ON idempotency_keys (expires_at);

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  venue_id     uuid,
  actor_type   text NOT NULL CHECK (actor_type IN ('STAFF','GUEST','SYSTEM','PROVIDER')),
  actor_id     text,
  action       text NOT NULL,                              -- SESSION_CLOSED, CASH_PAYMENT, SPLIT_LOCKED, MENU_EDIT...
  entity_type  text NOT NULL,
  entity_id    text,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_venue_time ON audit_log (venue_id, created_at DESC);

COMMIT;

-- =====================================================================
-- OPERATIONAL NOTES
-- 1. Row-level security: enable RLS per venue_id for staff-facing queries if using direct DB access;
--    otherwise enforce venue scoping in the data-access layer and test it.
-- 2. Money integrity: payment success handler runs in ONE transaction:
--      lock payment_transactions row -> set SUCCESS -> set bill_shares PAID -> update bills.paid_tzs
--      -> insert receipts -> insert realtime_events (outbox) -> COMMIT.
-- 3. Retention: purge payment_webhook_events payload after 13 months, realtime_events after 30 days,
--    expired idempotency_keys daily. Keep payment_transactions and receipts per tax record-keeping rules.
-- 4. Personal data: msisdn_enc must be encrypted with a key held outside the database (KMS/secret manager).
-- =====================================================================
