# Cloud-Menu Sprint 1 ordering and administration foundation

Implements the scan-to-order path, server-priced/idempotent orders, role-based staff login, menu administration and signed QR sticker generation. Adds the Preact/Vite/Workbox workspace, PostgreSQL schema/adapters, Redis rate-limit/publish adapters, payment-provider stub and CI quality budgets. Full KDS, bill splitting and real mobile-money workflows remain outside this sprint.

## Stories implemented locally

US-101, US-102, US-201, US-202, US-203, US-204, US-506, US-601, US-602, US-701. Full DoD acceptance remains open; do not treat this as a production release.

## Verification and measurements

- Unit/route integration tests: 41 passed, 2 explicit external-acceptance todos. Test-only memory adapter; PostgreSQL not executed locally.
- Browser tests: 4 passed, 0 failed, installed Edge at 360 × 800.
- TypeScript and ESLint passed. Both production apps built.
- QR sticker PDF rendered and both pages visually inspected; table labels and scan instructions have separate lines.
- Initial guest JS: 11,238 bytes gzipped, including registration script (budget 150,000).
- Lighthouse simulated Fast 3G / 4× CPU: p75 LCP 1656.25 ms across three cold runs (budget 4,000).
- Lighthouse simulated 4G / 4× CPU: p75 LCP 405.23 ms across three cold runs (budget 2,500).
- Cached repeat-shell FCP: 36 ms locally, without throttling (budget 1,500). This is shell paint, not field p75 or a physical Android result.

Measurements use a local DEMO three-item fixture without photos. Hosted CI, physical devices, staging and production measurements are not available.

## Unfulfilled DoD and delivery gates

- Peer review, PO acceptance, hosted green CI, merge to main and staging demonstrations: unfulfilled for every story.
- PostgreSQL 16 migration execution, database concurrency/rollback checks and Docker image execution: configured but unrun locally. No local PostgreSQL/Docker executable. Memory-store route tests do not establish database behavior.
- No pnpm lockfile: registry access failed after interrupted package setup. Direct versions are pinned, but transitive reproducibility is unverified. pnpm audit failed with ERR_PNPM_AUDIT_NO_LOCKFILE. No claim of zero high/critical vulnerabilities.
- US-201 physical mid-range Android / throttled 4G p75 criterion and US-204 staging KDS p95 ≤2s: explicit todos. Detailed roadmap places the full KDS in Sprint 2; S1 exposes read-only ticket data.
- Device matrix (physical low/mid Android and iOS Safari), 200% text, formal AA contrast/focus audit, printed QR scanning on three devices and native-speaker translation review: pending. One local Edge screenshot was visually inspected.
- SSE/WebSocket transports, Redis subscriber fan-out, pg-boss operational worker wiring, reconnect/resync and centralized observability/alerts are not complete. Durable order outbox and Redis publish/rate-limit production adapters are present. No later-sprint ticket-state/payment workflows were started.
- Images use local disk; shared production object storage/CDN, orphan cleanup, backup/restore and multi-node validation remain open. Non-Latin PDF glyphs beyond standard Latin are substituted until a Unicode font is selected.
- TLS/reverse proxy, edge protections, secret-manager deployment and staging infrastructure are not provisioned. Production ordering is behind ORDERING_ENABLED and defaults off.
- Destination repository: https://github.com/samrickie/cloud_menu. Direct Git networking is unavailable, so publication uses the connected GitHub API. The company proxy explicitly blocked uploads of docs/03-architecture/03_Architecture_API_Spec.pdf and docs/04-planning/04_Wireframes_Flows_Roadmap.pptx. These two originals remain local and are omitted from the remote history; no restriction was bypassed. The architecture DOCX and other supplied documents are included. No deployment, live venue data or live payment was produced.

## Open questions

Confirm staging target and an approved route for publishing the two proxy-blocked source binaries. Review the API-visible-ticket interpretation of US-204, signed quote extension and multi-account staff identifier. Confirm Swahili translation owner. Aggregator/region/fiscal/settlement decisions from the source remain open.

See docs/SPRINT_1_REPORT.md, docs/API_EXTENSIONS.md and docs/DECISIONS.md for detailed evidence and constraints.
