# Luxury venue platform implementation

The 31 October request expands the earlier Sprint 1-only scope. Work continues on feature/luxury-venue-platform from the complete local Sprint 1 implementation, preserving its existing tests and source documents. Runtime behavior follows the source documents; the user-provided Noir & Gold tokens govern the new visual system.

## Source access and constraints

The linked Claude canvas was not available through web access, and browser policy explicitly declined access to claude.ai. No alternate access is attempted. The user subsequently supplied a self-contained local HTML export containing all six boards and licensed font assets. Its authored HTML/CSS now supplies the visual reference. The reference is extracted without executing its embedded scripts; layout comparison screenshots remain to be captured. Existing local Office source documents and migration 0001 are retained unchanged.

The source vision lists card payments and promotions as post-MVP. The expanded request asks for them. Until provider documentation exists, payment integration remains a marked adapter boundary and sandbox; no invented hosted-checkout, wallet, bank verification or webhook protocol is presented as real. Promotional content can be modeled without asserting a real provider integration.

## Ordered delivery

1. Shared accessible tokens/themes and isolated owner app, registration, seven-step onboarding, venue types and data-driven public templates.
2. Tables & QR: range/single/CSV creation, seats/zones, unique signed venue/table links, revocation, status, themed sticker preview, A4 PDF, PNG and print-all.
3. Guest messages/chips, waiter calls, tracking, bills, deterministic equal/itemized splits and locks.
4. Kitchen/bar/waiter screens with safe transitions, notes, calls and cash recording.
5. Receiving-account verification states, payment adapters, sandbox flow, webhook/reconciliation boundary with explicit provider-document TODOs.
6. Venue-scoped SQL dashboard aggregates and cache, period comparisons, SVG charts, floor state, CSV and documented insight rules.
7. Service/tips, offers, private low-rating feedback and payout reporting.

Each slice starts with automated acceptance tests. All runnable checks run before commits. Visual snapshots at 360 and 1440 are implementation regression tests, not evidence of a canvas match. Additional folded/unfolded, tablet and 200%-text/reduced-motion checks cover responsive behavior; physical-device validation remains separate.
