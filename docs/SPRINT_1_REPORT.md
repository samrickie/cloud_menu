# Sprint 1 evidence and remaining gates

This is an engineering work log, not Product Owner acceptance. No production metrics or real venue data are included.

## US-101

Tests written before implementation. Three Vitest route integration tests pass using the explicitly test-only MemoryStore. PostgreSQL production adapter and supplied migration are present; database execution is unverified locally (no PostgreSQL/Docker executable available and package network access is blocked). Browser/device verification, staging demonstration, dependency audit, peer review, green hosted CI, merge and PO acceptance remain open.

## Environment

The initial package download completed but lifecycle setup was interrupted. Cached packages were linked locally and exact versions pinned to their package manifests. A normal reproducible pnpm install and hosted CI remain required. The public registry currently returns access errors. No remote repository has been supplied; the connected samrickie account has no Cloud-Menu repository. No deployment has been performed.

## Scope conflicts

See DECISIONS.md. Full KDS, staff WebSocket workflows, bill splitting and provider integrations remain Sprint 2 or later. The US-204 KDS latency acceptance criterion cannot be claimed by a Sprint 1 API-only ticket read model.
