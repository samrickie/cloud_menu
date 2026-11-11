# Branch operations and platform management

## Where to find the changes
- Owner → Service settings: branch-wide and station service limits; business-day cutoff.
- Owner → Branches: branch overview, address/contact edits, new branches and menu copy.
- Owner → Menu: bilingual ingredients, portion/size, allergens and notes.
- Owner → Tables & QR codes → Online menu QR: enable, copy, download, disable or rotate a browse-only menu.
- Kitchen/Bar/Waiter → attention cards: New, Acknowledge, optional muted sound, elapsed minutes, Overdue.
- Platform admin → Management: Businesses, Administrators (including pending invitations), Records & exports, Audit.
- Invitation link → choose your own password → /login. Email delivery is not yet configured.

## Manual acceptance checklist
Use explicitly labelled sample businesses and two separate devices or browser profiles.
1. Create one business with two branches and share its invitation privately. Activate once; retrying the link must fail. Reissue a pending link; the old one must fail.
2. Create food and drink categories with station routing, descriptions, images and allergens. Copy the menu to the other branch, review stock/availability, and verify subsequent edits remain independent.
3. Open a table QR. Browse categories on 360px mobile and desktop, inspect full specs, and order food plus drink with distinct notes.
4. Kitchen sees food only; Bar sees drink only. New styling appears within seconds. Acknowledge removes New without removing the ticket. Accept → Prepare → Ready transfers delivery to Waiter.
5. Create a waiter call; only Waiter gets the responsible-role alert. Enable sound via a gesture, then mute. Verify mute survives reload and another staff identity is independent.
6. Set short service limits. Let a stage expire: overdue text and elapsed minutes appear only for the responsible role, plus owner overview. Advance the stage and confirm the timer resets. Serve/complete and confirm it clears.
7. At the configured business-day boundary, completed older orders disappear from staff queues, unfinished ones remain, and owners retain history.
8. Open the online QR in a fresh browser. No cart, ordering, call or payment controls appear. Trying its token against order/session APIs must fail. Rotate and disable; old links must fail.
9. As an owner/staff member, attempt platform API access: forbidden. Attempt another branch's item/table/order IDs: no data is disclosed.
10. Admin deactivates a sample business with a reason. Check owner/staff login, existing sessions, table QR, online QR, orders and payment initiation. Reactivate and check that retained records and previous billing dates remain.
11. Soft-delete using the exact business name; verify hidden active use and retained records. Restore. Do not test permanent purge on real data; it requires retention expiry and a separate confirmation.
12. Export details, staff, orders, transactions and subscriptions, filtering business/branch/dates. Check both CSV and Excel. Downloads contain only the current page (200 rows maximum). Next exports the following page.
13. Record an actual sample subscription receipt and confirm amount/date/next due. Confirm this does not silently extend access. Add/remove another admin; self-removal and last-admin removal must fail. Review the audit.
14. Repeat key guest paths with slow network, 280/360/720/1440px, enlarged text and reduced motion. Test reconnect and duplicate submission.

## Known limitations / Definition of Done gaps
- No configured email sender: invitation delivery is manual. Do not paste invitation links into public channels.
- Real payment aggregator, signed provider webhooks and settlement certification remain outside this release.
- Physical Android/network field performance and production KDS latency have not been measured; local Lighthouse is synthetic sample data only.
- Cross-branch staff identity sharing is not implemented; accounts are branch-specific.
- Optional automatic deactivation based on unpaid subscription receipts is not implemented (off).
- Export files are paginated, not a single background-generated archive. Orders repeat order totals per item; sum line totals instead.
- Business/audit directory queries and all-branch overview need additional database-level pagination/aggregation for very large platforms. Export record queries are bounded.
- Some administrative record field names and state codes remain technical English; full Swahili localization of these tables is incomplete.
- Manual subscription receipts and billing access are separate actions. Payment provider automation is not claimed.
- Production backup/restore rehearsal and live migration verification remain required before calling this production-ready.

## Verification
See the accompanying validation results recorded after the final local test run. All browser fixtures and screenshots contain Sample data, not customer metrics.

### Local results — 11 November 2026
- TypeScript check and ESLint: passed.
- Vitest: 45 files passed; 156 tests passed, 2 pre-existing TODOs (physical-device LCP and staging KDS latency).
- Playwright: 24 tests passed, including branch invitations, lifecycle controls, station routing, read-only menu and existing billing/splits.
- Owner/admin/guest/staff production builds passed using Node 24 directly. The workstation's global pnpm wrapper selected an incompatible Node process; direct Vite commands used the intended runtime.
- Guest initial JavaScript: 21,444 bytes gzipped (budget 150,000).
- Lighthouse, three runs each, loopback Sample data with three items/no photos, 360px and 4x CPU: Fast 3G LCP 2049–2256 ms, p75 2256 ms, performance 97–99; 4G LCP 485–517 ms, p75 517 ms, performance 100.
- Screenshot baselines updated for the intentional branch picker, online-menu controls, guest category drawer and overdue overview.
- Local success is not evidence of a successful Render deployment.
