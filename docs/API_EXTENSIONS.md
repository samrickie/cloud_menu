# Additive Sprint 1 contracts

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

Menu writes bump version for ETag revalidation within the specified 60-second freshness window. All mutation queries validate the authenticated venue relationship. Item prices are capped at 1 billion TZS per item, quantities at 99, lines at 99 to keep API arithmetic safely within JavaScript's exact integer range. Database BIGINT values are converted only after safe-integer validation.

Reports, bill/split/payment endpoints and full KDS updates are not implemented. The manager-report guard returns 501 for managers and 403 for kitchen users, proving the role boundary without implementing future reporting stories.
