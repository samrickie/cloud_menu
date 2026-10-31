# Expanded platform delivery evidence

This is incremental work, not a production release. The original Sprint 1 report remains separate.

## Owner API foundation

Automated acceptance coverage includes registration and bcrypt hashing, trial venue/category creation, own-venue login/selection, foreign-owner denial, strict profile validation, measured contrast rejection, draft privacy, incomplete launch rejection, configured publication, public credential exclusion, and immediate disabled-account denial across owner/menu/table routes. Eleven owner API tests cover these boundaries and default sample inventory/station routing; tests pass locally against the test memory adapter; PostgreSQL execution is still unverified in this environment.

Shared themes have four passing contrast tests. The saved reference HTML is decoded without executing embedded JavaScript and its licensed Latin fonts are self-hosted.

Remaining DoD gates for this slice: verified email delivery/recovery/MFA; owned asset management; account verification and production registration enablement; subdomain DNS/host routing; receiving-account launch checks; PostgreSQL integration/migration execution; deployment, review and physical-device validation. Broad platform workflows and dashboard aggregates remain in the ordered implementation plan. Do not expose this incremental API as a payment-enabled production service.

Remote publication remains partial under the previously recorded corporate proxy restrictions. PR #1 is a draft of the earlier Sprint 1 work, not this feature branch. No new publication or deployment is claimed.

## Tables & QR API

Five additional tests cover range metadata, unique venue/table links, repeat generation reuse, single tables, atomic CSV validation, bad ranges, tampering, rotation, context binding, foreign list/export/rotation denial and PNG QR module pixels. The original three QR acceptance tests also pass. A4 PDF and ivory PNG were rendered and visually inspected locally; these are explicitly demo fixtures. Actual phone/scanner decoding and physical printer tests are still pending. The owner browser UI now supports style previews, ranges, single/CSV tables, PNG/PDF downloads, rotation confirmation and print-all. Exact export font fidelity is still pending.

## Owner browser UI

The isolated `apps/owner` app includes account and trial venue creation, seven setup steps, four layout variants, four preset themes/custom contrast checking, EN/SW, ordered sections, bilingual welcome and opening hours, live preview, menu creation with category station defaults, and Tables & QR. Tokens remain in memory and the production owner bundle sets a restrictive CSP. Payout verification is explicitly unavailable pending provider integration; go-live remains blocked for unverified accounts and sample-only inventory.

Browser acceptance tests cover saving settings and hours, adding a real menu item, incomplete publication rejection, table ranges/single/CSV, PNG/PDF downloads, rotation, print-all preparation, Swahili, 280/360/720/884/1440 px layouts, enlarged text and reduced motion. Setup and table screens have 360/1440 regression snapshots. Snapshot QR images and random venue slugs are masked; these snapshots do not prove exact canvas equivalence or phone scanner readability. Baselines were captured on Windows Edge; Linux CI comparisons still require execution/review.

The latest owner build is approximately 27.3 KB gzip JS, with fonts separate. Guest JS has not gained any owner/chart/QR modules. Do not reuse previous Lighthouse figures as measurements of this expanded platform.

## Guest operations API

Six local acceptance/security tests pass for waiter-call concurrent deduplication, acknowledgement permissions/replay, foreign-session denial, strict input, scoped order reads, authenticated SSE replay/live delivery, a connection race and unavailable subscription cleanup. Production has Redis subscriber wiring and bounded durable replay. These tests use the memory adapter and loopback HTTP; they do not certify PostgreSQL/Redis multi-node performance. Guest UI integration, staff state changes, bill updates, operational call retention/resolution and connection/load validation remain pending.

## Guest PWA visual and operations integration

Guest screens now use the recovered Noir & Gold fonts/tokens, bilingual kitchen-note chips, a modal cart, live session order snapshots, waiter reasons/messages and acknowledgement state. The guest bundle excludes owner QR generation and chart code. Browser tests cover menu/customisation snapshots, submitted notes, waiter requests, folded/unfolded widths, 200% text with non-overlapping floating actions, short landscape sheets, denied local storage with ordering, and a closed-session signal requiring explicit re-entry. These client checks do not complete US-206 until staff transitions and bill recalculation are implemented.

SSE requests have low network priority because a long-lived background stream must not compete with critical page content. Forced menu refresh uses a NetworkFirst service-worker rule; normal loads retain cached menu behavior. Private session/order writes are never queued offline. Native dialogs trap focus; sheets respect reduced motion and dynamic viewport height. Denied storage falls back to the current tab with an explicit persistence notice.

Fresh local Lighthouse evidence: initial guest JS 16,653 gzip bytes; three-run p75 Fast 3G LCP 1956.8877 ms and 4G LCP 485.00345 ms, both 4x CPU. All six fresh reports have no warnings. Build files are recorded in `.artifacts/lighthouse-summary.json`. The fixture has three explicitly labelled Sample data items and no photos, served on loopback; these are not field or production p75 results. Earlier runs with the streaming request at high priority timed out and are excluded. The budget harness now rejects incomplete reports and non-finite/missing metrics.

Remaining guest/operations work: staff state changes and availability events, bill/split/payment UI and contracts, reconnect/device/load validation and operational lifecycle/retention jobs. Production source publication, dependency audit/lockfile and deployment remain separate unresolved gates.

## US-301 billing API foundation

Server-side bill totals aggregate immutable order snapshots, exclude rejected/cancelled lines, retain modifier amounts, disclose included/exclusive tax and use integer BigInt rounding. Bills snapshot venue rates, emit atomic bill.updated events and have stable versions on repeated reads. Local tests cover three-order aggregation, updates, venue/session isolation, rate stability, unsafe/fractional money and loopback SSE timing. Guest bill UI, split/payment workflows, tax/fiscal approval and PostgreSQL execution remain separate gates; this API slice does not claim the complete billing experience is production-ready.

## US-302 equal-split API foundation

Local tests cover the exact 90,000/3 and 100,000/3 acceptance examples, all payer counts 1–50 at boundary totals including maximum safe integer money, ordered server-created slots, invalid counts/body/session fields, draft replacement and locked-split denial. The tenant-key/composite-FK migration is authored but PostgreSQL execution remains unverified. Guest split UI, claims and locking follow in the next stories; no payment-provider behavior is claimed.
