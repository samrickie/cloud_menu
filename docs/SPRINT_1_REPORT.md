# Sprint 1 implementation and evidence

The ten requested stories have local implementations and were developed in the requested order with tests written before their implementation. This is not a claim that every story meets the full Definition of Done. The two acceptance todos and all unfulfilled gates are explicit below. No Sprint 2 bill/split/payment/KDS-state story is implemented.

## Recorded local verification

- Unit/route integration tests: 41 passed, 2 explicit external-acceptance todos. Test-only memory adapter; PostgreSQL not executed locally.
- Browser tests: 4 passed, 0 failed, installed Edge at 360 × 800.
- TypeScript and ESLint passed. Both production apps built.
- QR sticker PDF rendered and both pages visually inspected; table labels and scan instructions have separate lines.
- Initial guest JS: 11,238 bytes gzipped, including registration script (budget 150,000).
- Lighthouse simulated Fast 3G / 4× CPU: p75 LCP 1656.25 ms across three cold runs (budget 4,000).
- Lighthouse simulated 4G / 4× CPU: p75 LCP 405.23 ms across three cold runs (budget 2,500).
- Cached repeat-shell FCP: 36 ms locally, without throttling (budget 1,500). This is shell paint, not field p75 or a physical Android result.

The benchmark uses an explicitly DEMO three-item menu with no photos on a loopback server. It does not validate a full venue menu, Tanzanian network latency, physical Android hardware or production KPIs. Raw reports and the screenshot are in ignored .artifacts/. Lighthouse CI and bundle budget checks are configured in GitHub Actions; hosted CI has not run.

## Story coverage and specific gaps

| Story | Implemented and tested locally | Specific acceptance gap |
| --- | --- | --- |
| US-101 | Signed/unknown/tampered QR, venue suspension, scoped token and friendly browser entry | Staging and device matrix |
| US-102 | Shared participants, default name/edit, proven rescan, concurrency limit | PostgreSQL concurrency and physical multi-device staging |
| US-201 | Categories, search, sold-out UI, private ETag cache, responsive image URLs | Physical-device p75; demo benchmark has no photos |
| US-202 | Required/max modifiers, price deltas, safe integer totals, browser customization | Full device/accessibility matrix |
| US-203 | Quantity, notes, removal, session-local persistence, immediate reload regression | Full device matrix |
| US-204 | NEW snapshots, order outbox, API ticket reads, atomic retries, quote confirmation, server prices | Staging KDS p95 criterion; no full KDS in S1 |
| US-506 | bcrypt PIN login, role restriction, five-failure/15-minute lockout, disabled staff | Hosted security audit; multi-account staff identifier extension needs PO acceptance |
| US-601 | Category/item/modifier administration, real >1MB image conversion, CSV row errors | Shared object store/CDN and staging pilot-menu trial |
| US-602 | T1–T14 QR PDF, per-table signatures, immediate rotation, venue scoping | Printed scans on three devices and Unicode font |
| US-701 | Workbox shell/menu/image cache, offline reload/banner, bundle and synthetic budgets | Hosted CI, physical/field measurements and complete resync transport |

## Definition of Done gaps applicable to this run

- Peer review, PO acceptance, hosted green CI, merge to main and staging demonstrations: unfulfilled for every story.
- PostgreSQL 16 migration execution, database concurrency/rollback checks and Docker image execution: configured but unrun locally. No local PostgreSQL/Docker executable. Memory-store route tests do not establish database behavior.
- No pnpm lockfile: registry access failed after interrupted package setup. Direct versions are pinned, but transitive reproducibility is unverified. pnpm audit failed with ERR_PNPM_AUDIT_NO_LOCKFILE. No claim of zero high/critical vulnerabilities.
- US-201 physical mid-range Android / throttled 4G p75 criterion and US-204 staging KDS p95 ≤2s: explicit todos. Detailed roadmap places the full KDS in Sprint 2; S1 exposes read-only ticket data.
- Device matrix (physical low/mid Android and iOS Safari), 200% text, formal AA contrast/focus audit, printed QR scanning on three devices and native-speaker translation review: pending. One local Edge screenshot was visually inspected.
- SSE/WebSocket transports, Redis subscriber fan-out, pg-boss operational worker wiring, reconnect/resync and centralized observability/alerts are not complete. Durable order outbox and Redis publish/rate-limit production adapters are present. No later-sprint ticket-state/payment workflows were started.
- Images use local disk; shared production object storage/CDN, orphan cleanup, backup/restore and multi-node validation remain open. Non-Latin PDF glyphs beyond standard Latin are substituted until a Unicode font is selected.
- TLS/reverse proxy, edge protections, secret-manager deployment and staging infrastructure are not provisioned. Production ordering is behind ORDERING_ENABLED and defaults off.
- Destination repository: https://github.com/samrickie/cloud_menu. Direct Git networking is unavailable, so publication uses the connected GitHub API. The company proxy explicitly blocked uploads of docs/03-architecture/03_Architecture_API_Spec.pdf and docs/04-planning/04_Wireframes_Flows_Roadmap.pptx. These two originals remain local and are omitted from the remote history; no restriction was bypassed. The architecture DOCX and other supplied documents are included. No deployment, live venue data or live payment was produced.

## Open product and deployment questions

Confirm the staging platform/region and cost constraints; review the roadmap interpretation of US-204 and the added quote/staff-identifier contracts; assign Swahili copy ownership. The company upload restriction needs an approved publication route for the two omitted binary references. Source-document aggregator selection, settlement model and tax/fiscal/privacy decisions remain open for later readiness gates.

Original documents and schema are preserved. DECISIONS.md records document conflicts, extension choices, arithmetic bounds and environment limitations.
