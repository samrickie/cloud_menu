# Sprint 1 decisions

The supplied documents are the product authority. Original Office files are preserved under their requested folders. `0001_init.sql` is byte-for-byte the supplied `03_cloud_menu_schema.sql` (its PostgreSQL 15+ header is compatible with the requested PostgreSQL 16).

1. Sprint scope: follow the detailed roadmap S1 exit criterion, ticket data visible through API. US-204 mentions KDS within 2 seconds, while US-501/502 put the full queue and state transitions in S2. S1 stores ticket snapshots and exposes a read-only staff ticket list. No split, bill, payment or ticket-state workflows are implemented.
2. Canonical future staff WebSocket URL is `/v1/ws` (endpoint overview and section 10.2). Section 3 also calls it `/v1/staff/ws`. Full staff real-time UI is S2.
3. Repricing before confirmation: add authenticated `POST /v1/sessions/:id/order-quote` returning server-priced lines and a signed, expiring quote. POST orders accepts additive `quote_token`; stale quotes yield 409 PRICE_CHANGED and create no order. Without a quote, the documented order endpoint still reprices all lines server-side. The guest always quotes and confirms a changed total before sending.
4. New admin contracts are documented in `docs/API_EXTENSIONS.md`; the source has no admin endpoint shapes. All use venue scoping and MANAGER/OWNER authorization. Soft delete preserves order history.
5. Participant name editing uses PATCH `/v1/sessions/:id/participant` for the current token's participant only. A device proof issued at first scan is needed to recover a participant token on rescan; the public random device UUID alone is not authentication. The guest persists that proof locally.
6. Guest session tokens last six hours, staff tokens one hour. Session tokens are reused while unexpired on an authenticated rescan. Secrets are supplied through environment/secret manager, never source. At most 20 participants unless the venue explicitly configures less.
7. No real venue data: all fixtures/seeds explicitly say DEMO. Example names and prices originate in backlog examples and wireframes and do not describe an operating venue. No production metrics are claimed.
8. EN/SW translations are draft engineering copy pending Product Owner/native-speaker review. Aggregator, fiscal treatment, cloud region and settlement model remain open source-document decisions.
9. Empty local repository: create a source-only main baseline, then exact requested `sprint-1` branch. Use the connected samrickie profile as the local commit author. Remote destination remains pending user input.
10. External DoD gates (peer review, merge through green CI, PO review, staging, physical device tests) cannot be self-certified. Track evidence and gaps per story in `docs/SPRINT_1_REPORT.md`.
