# Admin and staff improvements — acceptance checklist

Use two separate staff accounts and two sample venues. Do not use real customer orders for testing.

## 1. Venue filters

- [ ] Open **Admin → Venues**. Search by venue name, venue code, and owner email.
- [ ] Combine access state, billing model, real/sample data, registration dates, upcoming expiry, and order activity.
- [ ] Try a combination with no matches. Clear filters and confirm venues return.
- [ ] Sort newest/oldest, alphabetically, and by most orders. Confirm pagination totals reflect the filters.
- [ ] Enter an end date before the start date; expect validation, not misleading results.
- [ ] Trial/monthly expiry filters exclude grace days and already expired access. Registration date boundaries use UTC.

## 2. Per-venue billing

- [ ] Open a venue and find **Venue billing terms**. Compare its terms with platform defaults.
- [ ] Uncheck **Use platform defaults**. Choose monthly or pay-per-service, enter monthly TZS price, sales percentage, and sales basis.
- [ ] Enter the exact venue code and a meaningful reason. Save.
- [ ] Confirm the owner sees the negotiated rates on their subscription screen; another venue retains its own rates.
- [ ] Restore defaults and confirm current defaults apply to this venue without changing the global defaults.
- [ ] Try a wrong venue code, negative price, fractional TZS amount, percentage above 100, or a stale form in a second tab. Expect rejection.
- [ ] Refresh after saving. Confirm the terms persist and **Recent activity** contains the reason and billing-change entry.
- [ ] Change an active sales percentage after test sales. Confirm earlier sales retain their old rate in the estimated fee.
- [ ] Change a monthly price. Existing subscription records must retain their historical price; the next access extension uses the new price.
- [ ] Switch active sales to monthly: access pauses until the admin grants a monthly extension. Switching monthly to sales preserves unused paid/trial time.
- [ ] Editing pricing must not restore revoked access or create a payment transaction.

## 3. Staff notification bell

- [ ] Sign in separately as kitchen, bar, and two waiters. Keep the app visible.
- [ ] Place a food-only order: kitchen and waiters receive it; bar does not.
- [ ] Place a drink-only order: bar and waiters receive it; kitchen does not.
- [ ] Place a mixed order: each station sees only its own item names. Both remain on the guest's combined bill.
- [ ] Mark a line ready while the other station is still preparing: waiters receive a ready-pickup alert.
- [ ] Send a guest waiter request: waiters receive it; kitchen/bar do not.
- [ ] Open the bell, inspect order/table details, and select a notification to open Orders.
- [ ] Mark all read as waiter A. Waiter B's unread count must remain unchanged.
- [ ] Reload waiter A or sign in on another device with the same staff account: read state persists.
- [ ] Place another order while the bell is open, then mark the previously fetched batch read. The newer order must remain unread.
- [ ] Use another venue's staff account: no notifications from the first venue appear.
- [ ] Check at 280, 360, 720, 884, and 1440 px; keyboard users can open the bell, use actions, and close with Escape.

Notifications refresh every five seconds while the app is visible, plus on window focus. The bell shows the latest 50 events from seven days; its count includes all unread matching events in that window. Reading a notification does not accept an order, acknowledge a guest call, or mark food served. Waiter alerts are venue-wide because personal table assignments do not yet exist. Background push and audible alerts are not included.

## Decisions to consider next

1. Should managers assign tables/zones to individual waiters, with fallback to the whole team?
2. Should unacknowledged ready pickups escalate after a configurable number of minutes?
3. Should negotiated pricing require owner acceptance or an effective date before it becomes active?
4. Should admins be able to save named venue-filter views and export the filtered list?
5. Should staff opt in to sound or background notifications, subject to browser permission?

Record actual test outcomes, tester, date, venue, device, and evidence separately. This checklist is not a claim that its manual steps have been executed.
