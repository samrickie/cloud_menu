# Expanded platform delivery evidence

This is incremental work, not a production release. The original Sprint 1 report remains separate.

## Owner API foundation

Automated acceptance coverage includes registration and bcrypt hashing, trial venue/category creation, own-venue login/selection, foreign-owner denial, strict profile validation, measured contrast rejection, draft privacy, incomplete launch rejection, configured publication, public credential exclusion, and immediate disabled-account denial across owner/menu/table routes. Eight owner API tests pass locally against the test memory adapter; PostgreSQL execution is still unverified in this environment.

Shared themes have four passing contrast tests. The saved reference HTML is decoded without executing embedded JavaScript and its licensed Latin fonts are self-hosted.

Remaining DoD gates for this slice: owner browser UI, template/live preview and snapshots; verified email delivery/recovery/MFA; owned asset management; account verification and production registration enablement; station default application; subdomain DNS/host routing; receiving-account launch checks; PostgreSQL integration/migration execution; deployment, review and physical-device validation. Broad platform workflows and dashboard aggregates remain in the ordered implementation plan. Do not expose this incremental API as a payment-enabled production service.

Remote publication remains partial under the previously recorded corporate proxy restrictions. PR #1 is a draft of the earlier Sprint 1 work, not this feature branch. No new publication or deployment is claimed.

## Tables & QR API

Five additional tests cover range metadata, unique venue/table links, repeat generation reuse, single tables, atomic CSV validation, bad ranges, tampering, rotation, context binding, foreign list/export/rotation denial and PNG QR module pixels. The original three QR acceptance tests also pass. A4 PDF and ivory PNG were rendered and visually inspected locally; these are explicitly demo fixtures. Actual phone/scanner decoding and physical printer tests are still pending. Owner UI, style previews and print-all interactions are the next slice; exact export font fidelity is also pending.
