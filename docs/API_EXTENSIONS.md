# Additive Sprint 1 contracts

## Expanded owner contracts

New owner routes use the same problem envelope and no-store response policy. Account and staff bearer tokens have distinct kinds and one-hour expiry. Owner routes accept strict objects; venue IDs are taken from authenticated context, never client profile fields.

| Route | Input / result |
| --- | --- |
| POST `/v1/owner/accounts` | `{name,email,password}` (12–72 UTF-8 bytes); account token; production registration disabled by default |
| POST `/v1/owner/auth/login` | Email/password; account token and owned venue summaries; throttled and locks after five recent failures |
| POST `/v1/owner/venues` | Account token; `{name,slug,venue_type}`; private trial venue, bilingual category presets with station defaults, a flagged default sample table and unavailable Sample data item, scoped owner staff token |
| POST `/v1/owner/venues/:id/select` | Account token; returns staff token only for an owned venue; foreign ID returns 404 |
| GET `/v1/owner/site` | Scoped owner token; own draft settings and verification/publication states |
| PUT `/v1/owner/site` | Scoped owner token; partial theme/template, brand hex/foreground, unique EN/SW languages, ordered unique sections including Menu, bilingual welcome, weekday opening/closing hours; logo/cover currently null only |
| POST `/v1/owner/site/publish` | Scoped owner token; validates launch prerequisites; 422 ONBOARDING_INCOMPLETE with missing steps |
| GET `/v1/sites/:slug` | Public, throttled; published active/trial site with whitelisted menu fields; drafts return 404 |

Logo/cover uploads, email verification delivery, subdomain DNS routing and payment launch verification are pending integration gates. No verification state can be asserted by the client.

The supplied architecture remains authoritative for its named endpoints. All errors are RFC 7807 `application/problem+json`, including `code`, `status`, `detail`, and correlation `request_id`.

## Guest

- `POST /v1/sessions/init`: original payload plus optional `device_proof`. A first scan returns the original response plus a random proof. Rescanning the same device UUID must present that proof to recover its participant and token. The UUID is not treated as a credential.
- `PATCH /v1/sessions/:id/participant`: Bearer session token, `{display_name}`. Changes only the token's participant. Names: 1–60 trimmed characters.
- `POST /v1/sessions/:id/order-quote`: session token and the documented order body. Returns `lines`, `subtotal_tzs`, `quote_token`. The token expires in five minutes and binds the session, item selections, notes and server prices.
- `POST /v1/sessions/:id/orders`: original request plus optional `quote_token`. A stale quote returns 409 `PRICE_CHANGED` without writing an order. Both header key and `client_order_id` are checked inside the venue transaction. Same business cart with a refreshed quote safely replays; changed selections/notes/quantity return 422 `IDEMPOTENCY_CONFLICT`.

## Staff

`POST /v1/staff/auth/login`: `{venue_code, staff_id?, pin}`. Returns `{staff_token, role, token_expires_at}`. Staff identifier may be omitted only when the venue has one active staff account. Five wrong PINs in ten minutes lock that account for fifteen minutes. The token lasts one hour, and every protected read checks the active account and current role.

`GET /v1/staff/orders`: read-only ticket data, venue scoped. Kitchen/bar accounts see their own station. This is the roadmap's Sprint 1 ticket visibility criterion. Full KDS transitions, alerts, WebSocket workflows and latency acceptance remain later work.

## Manager and owner only

| Endpoint | Payload or result |
| --- | --- |
| GET `/v1/admin/menu` | Categories/items and all venue modifier groups/options |
| POST `/v1/admin/categories` | `{name_en,name_sw?,sort_order?}` |
| PATCH `/v1/admin/categories/:id` | Names, sort order, `is_active`; hidden categories preserve history |
| POST `/v1/admin/modifier-groups` | Names, selection SINGLE/MULTI, min/max, `modifiers:[{name_en,name_sw?,price_delta_tzs,is_available?}]` |
| PATCH `/v1/admin/modifier-groups/:id` | Names and min/max; rules validated |
| PATCH `/v1/admin/modifiers/:id` | Names, integer price delta, availability |
| POST `/v1/admin/items` | category_id, names/descriptions, integer price_tzs, station, availability, image_key?, modifier_group_ids[] |
| PUT `/v1/admin/items/:id` | Full item replacement with same shape, group links replaced atomically |
| DELETE `/v1/admin/items/:id` | Soft hide |
| POST `/v1/admin/items/import` | `{csv}` with category_id,name_en,name_sw?,price_tzs,station; result `{created,errors:[{row,code}]}`; 1000-row limit |
| POST `/v1/admin/images` | Raw JPEG/PNG/WebP body with matching Content-Type, maximum 10MB/16MP; result image_key and 320/640/960 WebP variants |
| GET `/media/:file` | Public immutable image variant; generated filenames only |
| GET `/v1/admin/tables` | Active tables and signed guest URLs |
| POST `/v1/admin/tables` | `{labels:string[]}`; 1–100 labels, duplicate existing labels reused |
| POST `/v1/admin/tables/:id/rotate` | Increment key version, audit, return new signed URL; old stickers stop working |
| GET `/v1/admin/tables/qr.pdf` | A4 PDF, 12 stickers/page, signed QR, venue name and table label |

Expanded Tables & QR additions: POST `/v1/admin/tables` also accepts `{tables:[{label,seats?,zone?}]}` (strict alternative to `labels`). POST `/v1/admin/tables/range` takes `{from,to,prefix?,seats?,zone?}`, integers 1–99999, at most 100 per request. POST `/v1/admin/tables/import` takes `{csv}` with `label,seats,zone`, at most 100 rows; all rows validate before the transaction, and an invalid import changes nothing. Existing labels are reused without overwriting metadata; responses include created/reused counts. Each venue is limited to 1000 tables. List responses include QR status and rotation time and omit internal QR signing fields.

GET `/v1/admin/tables/:id/sticker.png` returns a 1080×1440 themed sticker. It and the A4 PDF endpoint accept `style=noir|ivory|venue` and `locale=en|sw`. Exports require scoped manager/owner authorization and are rate limited. QR matrices use black on white with a four-module quiet zone in every theme. PDF has 12 stickers per A4 page with prominent table numbers. Font handling currently uses standard PDF Helvetica and system SVG serif/sans; browser preview uses the supplied fonts. Physical printer/scanner validation and exact exported font fidelity remain DoD gaps.

New and rotated QR tokens retain the documented `code.signature` endpoint shape. Format 2 HMAC input additionally binds immutable venue ID and current table label. Links include venue slug and table label as readable query parameters; authorization derives solely from the signed token's database mapping. Legacy format 1 stickers remain valid until rotation. Rotation atomically upgrades to format 2 and increments key version. No client can select a foreign venue for generation, list, rotation or export.

Menu writes bump version for ETag revalidation within the specified 60-second freshness window. All mutation queries validate the authenticated venue relationship. Item prices are capped at 1 billion TZS per item, quantities at 99, lines at 99 to keep API arithmetic safely within JavaScript's exact integer range. Database BIGINT values are converted only after safe-integer validation.

Reports, bill/split/payment endpoints and full KDS updates are not implemented. The manager-report guard returns 501 for managers and 403 for kitchen users, proving the role boundary without implementing future reporting stories.

Expanded menu creation permits omitted station, using the category default station (KITCHEN for existing categories). Editing an onboarding sample item adopts it as real inventory; newly created normal items are real by default. A range/single table request adopts a matching flagged default sample table with the explicitly assigned metadata. Other existing tables retain metadata on duplicate generation.

## Guest operations and live events

GET `/v1/sessions/:id/orders` requires a current guest token bound to that session. Returns `{orders,seq,truncated}` with at most 200 newest orders, item statuses, notes and snapshot amounts; internal hashes and device identities are omitted. A transaction reads the consistent venue event head. The bill endpoint, when implemented, remains the authority for the complete monetary balance.

POST `/v1/sessions/:id/waiter-calls` accepts strict `{reason:HELP|BILL|CLEAN_TABLE|WATER,message?:string}` (500 characters). Venue/table/participant come from the session. Requests within 60 seconds reuse the prior table call: 200 `{call,repeated:true}`. New calls return 201 and write waiter.called atomically. Concurrent taps across participants create one alert.

GET `/v1/staff/waiter-calls` lists up to 200 unresolved venue calls with table labels. POST `/v1/staff/waiter-calls/:id/acknowledge` requires WAITER/MANAGER/OWNER; sets ACKNOWLEDGED once, records actor/time and emits waiter.acknowledged. Same-waiter replay returns 200; another waiter gets 409 CALL_ALREADY_ACKNOWLEDGED. Foreign IDs return 404.

GET `/v1/sessions/:id/events` follows the source SSE contract. Authorization is a bearer header, never a URL credential. Last-Event-ID is a nonnegative safe integer. Deliver only the authenticated session's events and venue-wide menu.item_availability. An ahead-of-head cursor returns 409 EVENT_CURSOR_INVALID. Subscription failure returns 503 REALTIME_UNAVAILABLE before opening a stream. Heartbeats every 20 seconds revalidate the session; token expiry closes the stream. Clients resnapshot on resync.required and reauthenticate on auth.expired.

Subscribe before replay and queue concurrent live events. Bounded replay batches, pending queues and output buffers disconnect slow clients for replay. Limits: three streams/participant, 5000/API instance. A broker reads the durable outbox once per active venue, using Redis notifications with a five-second venue-level recovery poll. These are implementation limits, not measured capacity/latency. Multi-node Redis/PostgreSQL and 9000-connection load checks remain pending.
