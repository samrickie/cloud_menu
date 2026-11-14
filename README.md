# Cloud-Menu

The actual connected staging application is at https://cloud-menu-staging.onrender.com (owner `/owner/`, staff `/staff/`, platform `/admin/`, guests enter through signed table QR links). The free service can sleep and its free database expires on 2 December 2026. See [owner, manager and kitchen procedures](docs/OWNER_OPERATIONS.md).

GitHub Pages: the root `index.html` is a clearly labelled static design preview with six supplied reference boards, not the live ordering application. See [GitHub Pages setup and limits](docs/GITHUB_PAGES.md).

To run the actual connected application locally, build all apps with `pnpm build`, then use `pnpm exec tsx tools/demo-server.ts` for the labelled, disposable loopback sandbox. It prints a signed guest link; owner setup is at http://127.0.0.1:4173/owner/ and staff sign-in at http://127.0.0.1:4173/staff/. Owner-created menu items and tables connect to that same guest app. Sandbox data is lost on restart and no real payments are configured. The production start uses PostgreSQL/Redis; `SERVE_FRONTENDS=true` serves the built apps from the API origin. Configure `GUEST_ORIGIN` to that actual HTTPS origin before printing QR stickers.

QR-based guest ordering for lounges and casual dining in Dar es Salaam. This branch extends the Sprint 1 ordering and administration foundation with the luxury venue platform in incremental slices. See [delivery status](docs/LUXURY_DELIVERY_STATUS.md) and [visual reference](docs/DESIGN_REFERENCE.md). All supplied examples and generated fixtures are explicitly **DEMO** data. Guest bills and splits, owner/manager reports and sellable-unit inventory are implemented. Station fulfillment and ready-item waiter handoff are implemented; real mobile-money integration remains unfinished.

## Setup

Use Node.js 24 LTS, pnpm 10.33.0, Docker Compose and Git. The workstation used for development has an older system Node, so local verification used the bundled Node 24 runtime.

1. Copy `.env.example` to `.env`. Set a local database password and match it in `DATABASE_URL`. Generate **independent** TOKEN_SECRET and QR_SECRET values with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep `.env` private. Production values must come from a secret manager.
2. Run `pnpm install --frozen-lockfile`. Direct dependencies and the reviewed dependency graph are pinned in `pnpm-lock.yaml`.
3. Run `docker compose up -d`.
4. Run `node --env-file=.env --import tsx tools/migrate.ts`. Migration 0001 is the supplied SQL unchanged. The migration runner verifies checksums of applied migrations and uses a transaction and advisory lock.
5. Optional demo: set `DEMO_STAFF_PIN` in `.env`, then run `node --env-file=.env --import tsx tools/seed.ts`. It prints the **DEMO** venue code, staff identifier and guest QR URL. It refuses to overwrite an existing demo venue. The PIN is hashed with bcrypt before storage and is never printed.
6. Run `pnpm dev`. API: port 3000. Guest PWA: port 5173. Staff admin: port 5174. Owner: http://localhost:5175/owner/. Vite proxies `/v1` and `/media` to the API.

For a disposable browser demo after building, use `node --import tsx tools/demo-server.ts` and open its printed guest URL. That server uses test-only memory state and binds to loopback. It is never used by the production start script.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm test` | Unit/API tests plus migrations and operations in embedded PostgreSQL |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint checks |
| `pnpm build` | Guest, staff, owner and platform-admin apps; Workbox guest service worker |
| `pnpm budget` | Measure initial production JS including static imports, enforce 150,000 gzip bytes |
| `pnpm exec playwright install chromium` | Install the CI browser |
| `pnpm test:e2e` | Guest flows plus owner/site/table flows, visual snapshots and folded/unfolded layouts |
| `node tools/lighthouse.mjs` | Three cold runs per Fast 3G/4G profile, 4x CPU, p75 budget; requires demo server on 4173 |
| `pnpm exec tsx tools/check-postgres.ts` | Explicitly gated isolated PostgreSQL migration/concurrency/rollback checks |
| `pnpm --filter @cloud-menu/api start` | Production API; requires configured PostgreSQL, Redis and secrets |

On this Windows workstation browser checks use `LOCAL_EDGE=1`; Lighthouse uses `CHROME_PATH` pointing to installed Edge. CI uses Chromium. Synthetic measurements against the local **DEMO** fixture do not establish field p75 on Tanzanian networks or physical Android devices.

## Architecture

`apps/guest-pwa`: Preact, Vite, TypeScript, Tailwind, Workbox. Categories, search, modifiers, session-local cart, signed price review and order confirmation. Guest UI copy is in `src/i18n.ts` (draft English/Swahili).

`apps/staff`: role login, station inventory and recent order notes; managers share the venue dashboard and menu/table controls. Kitchen/Bar advance station items through Accepted, Preparing and Ready; Waiter marks ready items Served.

`apps/owner`: onboarding, themed sites, dashboard, rich menu items, tables/QR, inventory, team and subscription model choice.

`apps/admin`: separate authorized platform console for registration KPIs, venue reports, pricing, audited trials/extensions and access revocation. See [platform administration SOP](docs/PLATFORM_ADMIN.md).

`apps/api`: Fastify REST, PostgreSQL production store, Redis rate limits and outbox notification publishing. Writers serialize per venue using PostgreSQL transaction-scoped advisory locks. The database's unique constraints remain the final integrity boundary. Guest SSE replays scoped durable events, with Redis wakeups and polling fallback. pg-boss runs split and subscription expiry sweeps. Staff WebSocket delivery and complete KDS fulfillment remain open work.

`packages/shared`: menu types, safe integer TZS pricing, modifier constraints, cart payloads and a PaymentProvider interface with an explicitly in-memory sandbox stub. No provider payloads, wallet validation rules or webhook schemes are invented.

An order stores immutable item/modifier price snapshots, note and station plus an outbox event inside one transaction. Server prices always win. A signed five-minute quote lets the guest review changed prices before confirming. Both the header idempotency key and session-scoped `client_order_id` prevent duplicates. A refreshed quote is excluded from the business-payload hash so a lost-response retry can safely use a refreshed quote for the same cart.

Optimized responsive WebP variants are stored in PostgreSQL with a 50 MB per-venue quota; `UPLOAD_DIR` is a legacy read fallback. Production should move media to shared object storage/CDN with cleanup. The service worker caches shell, venue menu and images; it never queues order writes while offline.

## Documents and delivery evidence

- [Vision, KPIs and personas](docs/01-vision/01_Vision_Charter_Personas.docx)
- [Backlog and definitions of Ready/Done](docs/02-backlog/02_Product_Backlog.xlsx)
- [Architecture and contracts](docs/03-architecture/03_Architecture_API_Spec.docx)
- Wireframes: `docs/04-planning/04_Wireframes_Flows_Roadmap.pptx` is preserved locally; company upload policy blocked its publication to GitHub.
- [Roadmap and risks](docs/04-planning/04_Roadmap_and_Risk_Matrix.xlsx)
- [Decisions and document conflicts](docs/DECISIONS.md)
- [Additional Sprint 1 contracts](docs/API_EXTENSIONS.md)
- [Evidence and DoD gaps](docs/SPRINT_1_REPORT.md)
- [Operations runbook](docs/RUNBOOK.md)
- [Owner, manager and kitchen SOP](docs/OWNER_OPERATIONS.md)
- [Platform administration and subscription SOP](docs/PLATFORM_ADMIN.md)

Repository: [samrickie/cloud_menu](https://github.com/samrickie/cloud_menu). Publication uses Git push with configured credentials. The architecture PDF (a duplicate of the included architecture DOCX) and wireframe PowerPoint remain local because the company proxy blocked their upload. The local original source snapshot remains preserved.

A separate free Render staging service is deployed; production hosting and acceptance gates remain open. A green local suite does not imply PO acceptance, peer review, successful hosted CI or production readiness.

Owner accounts are separate from staff PIN login. Enable `OWNER_REGISTRATION_ENABLED=true` only for development or explicitly temporary staging while verified email delivery is pending. The loopback demo server exposes `/owner/` and uses disposable memory state; production never uses it. Owner bearer tokens are held in memory and sign-out clears them; a reload requires signing in again.

The guest app now uses Noir & Gold and venue themes, note chips, live order snapshots and waiter calls. See [expanded delivery evidence](docs/LUXURY_DELIVERY_STATUS.md) for the exact tested slice and remaining gaps. Live staff fulfillment transitions are implemented; real payment-provider integration remains unfinished; guest billing/splits are connected to the API. Fresh local Lighthouse figures apply only to the labelled three-item/no-photo sample fixture.

Run `pnpm --filter @cloud-menu/api worker` alongside the API after applying migrations. It uses the same `.env` PostgreSQL/Redis connections and schedules bounded split-lock expiry checks with pg-boss. Request-time checks enforce expiry when a worker is delayed. Free Render staging runs this scheduler inside the web process. An always-on production worker and production shutdown testing remain gates.

Branch operations, platform management and release limitations: [November operations release](docs/OPERATIONS_RELEASE.md).
