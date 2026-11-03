# Platform administration and subscriptions

User-confirmed defaults: the two user-authorized platform-admin identities are configured privately; default trial is one calendar month; sales fee is 0.5% (50 basis points). Monthly price was not specified and remains unconfigured. Rates and the default trial must be adjustable.

## Boundaries

- `/admin/` is a separate application and bundle. A venue OWNER or MANAGER is never a platform administrator by implication.
- Platform access requires an active owner identity, verified email ownership, explicit operator allowlisting, and active platform membership. Exchange the account credential for a short-lived platform token; revalidate membership and account status on every global request. No signup parameter can grant this role. An operator can bind a reviewed account ID through an explicit bootstrap procedure; never promote an unverified email merely because it matches the allowlist.
- Use real SQL aggregates for registered venues, orders, successful collections and per-venue reports. Mark Sample data; never invent subscription payments or commercial customers.
- Owners choose MONTHLY or SALES_BASED with explicit, versioned terms. Configuration changes apply prospectively; existing accepted terms are snapshots. Unconfigured monthly pricing is not a zero-price offer.
- The initial sales-fee basis is successful collected gross sales. Show that basis in owner terms and allow the operator to configure it. Whole-TZS fee estimates use integer arithmetic. Collection, invoicing, refunds and aggregator settlement remain behind the provider integration gate; estimates are not charges or received platform revenue.
- Reuse the supplied subscriptions table as historical monthly-period records. An additive current-access record captures model, accepted terms, revision, trial/paid deadline and revocation without altering migration 0001.
- Existing venues retain explicitly labelled legacy/unmanaged access until reviewed. New registrations receive the configured one-calendar-month trial. Use calendar-month arithmetic with end-of-month clamping, not an invented 30-day substitute.
- Platform admins may grant trials, extend monthly access, approve a selected sales model, and revoke access. Require a reason, confirmed venue slug, expected revision and an idempotent action ID. Every action is audited. Extensions do not assert that payment was collected.
- Revocation and expiry must block new scans and existing-session ordering, including under the order transaction lock. Owners retain access to their own subscription/support screen. Data and outstanding bills are preserved.
- Monthly expiry uses the supplied seven-day configurable grace period; trials end at their deadline. Request-time enforcement and a bounded scheduled sweep suspend expired access. Free staging sleeps, so a request-time guard remains authoritative.

## Verification

Automate US-604 signup and overdue suspension plus new scenarios for platform role separation, verified-email bootstrap, private plan selection, prospective pricing, calendar months, audited/idempotent/stale admin actions, immediate guest suspension/resumption, global SQL aggregates, and owner/manager venue isolation. Exercise the actual admin login and owner subscription UI in Playwright at mobile/desktop/fold widths. Run native PostgreSQL checks in CI and preserve all existing operations tests.

## Release gates

Live administrator activation requires verified identity or explicit operator binding to a reviewed existing account ID. The existing social-provider credentials are still external setup items. Do not email invitations or credentials automatically. No automatic charging, provider deductions or subscription payment success may be simulated. Production needs operational backups, independent security review, real provider contracts and payment reconciliation.
