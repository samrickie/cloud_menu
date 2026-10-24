# Sprint 1 evidence and remaining gates

This is an engineering work log, not Product Owner acceptance. No production metrics or real venue data are included.

## US-101

Tests written before implementation. Three Vitest route integration tests pass using the explicitly test-only MemoryStore. PostgreSQL production adapter and supplied migration are present; database execution is unverified locally (no PostgreSQL/Docker executable available and package network access is blocked). Browser/device verification, staging demonstration, dependency audit, peer review, green hosted CI, merge and PO acceptance remain open.

## Environment

US-102: five tests written first then passed for shared joins, proven device rescans, 20-person concurrency limit, identity recovery protection and cross-session authorization. Same external DoD gates as US-101 remain open.

The initial package download completed but lifecycle setup was interrupted. Cached packages were linked locally and exact versions pinned to their package manifests. A normal reproducible pnpm install and hosted CI remain required. The public registry currently returns access errors. No remote repository has been supplied; the connected samrickie account has no Cloud-Menu repository. No deployment has been performed.

## Scope conflicts

See DECISIONS.md. Full KDS, staff WebSocket workflows, bill splitting and provider integrations remain Sprint 2 or later. The US-204 KDS latency acceptance criterion cannot be claimed by a Sprint 1 API-only ticket read model.
`nUS-201: menu route tests cover categories, sold-out state, private ETag revalidation and venue isolation. Guest UI adds category anchors, search and responsive photo variants. Physical-device LCP is an explicit todo. Synthetic budgets will be evaluated with US-701.
`nUS-202: required/max modifier validation, integer price adjustment and invalid/sold-out inputs have automated unit coverage. Native dialog customization UI is implemented; physical device review remains open.
`nUS-203: four tests cover quantity edits, notes in order payload, session-scoped persistence and malformed local data. Cart UI supports removal and review. Browser reload verification remains pending.
`nUS-204: tests cover NEW snapshots/events, read-only ticket API, concurrent idempotency, stale quote refusal, server repricing and atomic sold-out rejection. KDS p95 staging criterion is explicitly pending because the detailed roadmap assigns full KDS to S2. No local API timing is reported as that metric.
