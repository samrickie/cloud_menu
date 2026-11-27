# Platform administration SOP

The connected platform console is `/admin/`. Venue owners use `/owner/`; managers, kitchen and bar staff use `/staff/`. A venue OWNER is not a platform administrator.

## Activate the two authorized administrators

The operator configures the two user-authorized email addresses in Render's `PLATFORM_ADMIN_EMAILS`, separated by a comma. Keep this list in environment configuration, not public source files. Each administrator uses their own account and credentials; do not share passwords or bearer tokens.

1. Create an owner identity at `/owner/` if it does not already exist. An administrator does **not** need to create a restaurant or venue. Stop after account registration and open `/admin/`.
2. Use the existing password, or configured Google/GitHub sign-in. A configured social provider verifies email ownership. The existing OAuth callback URLs remain `/v1/owner/oauth/google/callback` and `/v1/owner/oauth/github/callback`; the encrypted login flow permits only the fixed owner/admin return paths.
3. An allowlisted identity with verified email ownership receives active platform membership when it signs in. Merely typing an allowed email into signup never grants global access.
4. If email verification or social credentials are not yet configured, the authenticated admin sign-in screen displays **Your account ID**. The person must sign in to their own account and provide that ID to the trusted operator. Do not send a password or token.
5. After reviewing the specific account ID and matching email, the operator can set `PLATFORM_ADMIN_BINDINGS` to a JSON array of `{id,email}` objects and deploy. For example, replace every placeholder in `[{"id":"11111111-1111-4111-8111-111111111111","email":"admin-one@example.com"}]` with the reviewed values. The server refuses mismatched IDs/emails and records an operator-binding audit event. This grants the reviewed account a role; it does not falsely mark the email as verified. Disabled membership is never silently reactivated by this bootstrap.
6. Sign in again. Platform tokens last ten minutes, stay in browser memory and are rechecked against active account, allowlist, membership and authentication version on every global request. Removing authorization denies subsequent requests, including requests using an existing token.

The environment settings merge with the existing Render configuration. Never replace or expose database credentials, signing secrets or provider secrets while adding administrator settings. No invitation or credential email is automatically sent by this implementation.

## Set the commercial terms

Open **Billing plans**. The user-confirmed defaults are **0.5% of sales** and **one calendar month of trial**. The monthly TZS price is initially **not configured**, because no amount was supplied.

- Enter a monthly whole-TZS amount, or leave it unconfigured. An explicit zero is a free plan; blank is not a zero-price offer.
- Adjust the sales percentage, sales basis, default trial months and monthly grace days. The initial sales basis is successful collected gross sales. The alternative is placed-order line sales excluding cancelled/rejected lines. Show the basis clearly to owners.
- Trial months use Dar es Salaam calendar-month arithmetic and clamp month ends. One month from 31 January ends on 28 February, or 29 February in a leap year. It is not silently replaced by thirty days.
- Zero default trial months disables automatic trial access for new registrations. It never creates unlimited access. Existing venues retain clearly labelled **Legacy access** until the operator reviews them.
- Monthly grace defaults to the supplied schema's seven days. Trial access ends at its trial deadline, without an extra monthly grace period.
- Enter a reason and save. Revisions reject stale edits. Configuration changes apply to future accepted terms; they do not silently raise an existing customer's accepted price.

## Owner chooses a model

The owner opens **Subscription**, chooses **Monthly subscription** or **Pay per service**, reviews the displayed terms and confirms the choice. The server snapshots the accepted pricing version, price/rate, basis and grace. Saving a preference does not charge money or grant the owner more access. An unconfigured monthly preference requires later price confirmation before activation.

An active plan change requires coordinated administrator review. Automatic switching, proration and refunds are not implemented. Existing accepted terms remain intact until an explicit reviewed change.

## Review and control a venue

Open **Venues**, search by name/code, and choose **View venue**. The list shows real lifetime orders, collected sales, owner email, model and access state. The detail includes the venue's existing KPI dashboard and recent audit activity.

For every access change, open **Confirm access change**, choose the action, type the exact venue code and enter a reason. The confirmation fields reset between actions. Action IDs make a lost-response retry safe; revisions refuse stale changes.

| Action | Result |
| --- | --- |
| Grant trial | Grants an explicit number of calendar months/days; preserves remaining existing access before adding the grant |
| Extend monthly access | Extends a selected, priced monthly plan; preserves unused trial/paid access; records a historical subscription period |
| Approve sales-based access | Activates the owner's accepted sales model, preserves unused trial/access before fees begin, and closes superseded active monthly-period records |
| Revoke access | Suspends new scans and existing-session ordering immediately; preserves menus, orders, bills and history |

An access grant is not a payment receipt. Verify subscription payments separately. During revocation, coordinate settlement of existing bills with venue staff; the records remain preserved, but guest ordering/bill APIs are paused. A subsequent explicit grant resumes access; guests can retry or rescan the valid table QR.

Overview counts and venue-list access labels derive expired deadlines at read time, including after the free service sleeps. These reads do not depend on the sweep having run. Request-time guards enforce expiry even when background processing is delayed. A bounded pg-boss sweep also suspends expired access every minute while the service runs. Order creation rechecks access under the same venue transaction lock as revocation, pricing and stock changes. A database trigger also refuses new orders for suspended/expired access, protecting the commerce boundary if an application path omits its check. Rollbacks must retain the current API access guards; earlier builds do not fully enforce the new staff/guest access policy.

## Understand the figures

Registered venues are actual database records, including explicitly labelled sample venues. Model counts represent choices, not confirmed subscription payments. Order totals use immutable order snapshots. Collected sales are successful venue payment transactions, not platform SaaS revenue. Empty observations remain empty; no canvas sample metrics are inserted.

Sales terms start after any unused existing trial/access. Before that date, the console shows the future start rather than pretending to have a current charge. For an active sales-based period, **Estimated service fee** uses actual sales since activation or the start of the current Dar es Salaam calendar month, whichever is later. It rounds once to whole TZS using integer arithmetic. For example, 0.5% of TZS 100,000 is TZS 500. The display explicitly states that no charge was initiated. Inactive/revoked/trial plans do not display a current active-period estimate. Historical invoicing and reconciliation require a billing ledger; this estimate is not a substitute for one.

## Production gates

Automatic subscription charging, invoice issuance, refund adjustments, aggregator deductions, live webhooks and fee settlement are not connected. Provider contracts/docs and verified receiving accounts are required before money collection can be activated. Administrator MFA/step-up, independent security/accessibility review, operational backups and restore tests, production load checks and PO acceptance remain release gates.

Free Render staging can sleep and its database expires on **2 December 2026**. A one-month business trial does not extend the hosting plan. Arrange durable production hosting before offering real customer trials. No paid resources have been created by this update.
