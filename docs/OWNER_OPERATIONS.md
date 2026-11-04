# Owner, manager and kitchen operations

This describes the connected application, not the separate GitHub Pages design reference.

## Sign in and find the dashboard

Owners use `/owner/` with their owner email and password (or a configured social provider). Existing venue sign-in opens **Dashboard**. New venues initially open setup; Dashboard remains in the navigation, including on mobile.

Owners open **Team**, enter a staff name, choose Manager, Kitchen, Bar or Waiter, and assign a unique 6–12 digit PIN. Share the venue code (website slug), staff identifier and PIN privately. Staff use `/staff/`. Managers open on Dashboard; kitchen/bar staff open on Inventory. Disabling a staff account immediately denies subsequent API requests, including requests using an existing token. Staff sessions expire after one hour. Owner accounts cannot be created, disabled or promoted through the Team form.

## Add food and drinks

1. Open **Menu**. Choose the category and station, enter the English name, optional Swahili name, whole-TZS price, and English/Swahili descriptions.
2. Choose a JPEG, PNG or WebP photo up to 10 MB and 16 megapixels. Wait for its preview before saving. Uploads require authorization before body parsing, are limited to 20 per venue per minute and two simultaneous decodes per API process. The server validates and re-encodes the image into responsive WebP variants; it strips embedded metadata. Existing items have **Edit item** controls.
3. Save, then open **Inventory** to configure the sellable count. Existing items remain untracked until explicitly enabled; migration never guesses a stock count.
4. Check the item through an actual table QR. Descriptions appear on the menu and customization sheet; the full photo appears in the sheet. Use modifier options for chargeable extras. Preparation notes are free text and never change the price.

Optimized photos are stored in PostgreSQL, with a 50 MB allowance per venue and 2 MB per variant. This survives web-service restarts on current staging. Production should use durable object storage with lifecycle cleanup and a CDN. Legacy filesystem images have a compatibility fallback and should be migrated before relying on them. The free staging database expires on **2 December 2026**; this storage arrangement does not extend its lifetime.

## Daily stock procedure

These are **sellable units**: portions, bottles, cups, or other menu-item units. Ingredient recipes, purchasing, suppliers, cost of goods and warehouse transfers are not implemented.

1. At opening, the responsible kitchen/bar staff member counts their station's items. Open **Manage stock**, enable **Track stock**, select **Count**, enter the physical total and a low-stock threshold, and record a reason.
2. Use **Receive** for deliveries or newly prepared portions; its units are added. Use **Waste** for spoilage/breakage; its units are subtracted. Count replaces the total. Every change records the actor, reason, time, delta and remaining count in the database.
3. A placed order deducts once in the same transaction that creates the order. Retries cannot deduct twice. Duplicate item lines are combined for the stock check. Competing purchases of the final unit have a single winner; an insufficient-stock order rolls back completely.
4. At zero, guests see Sold out. Replenishing makes a tracked item available again only if its manual menu-availability switch is enabled. Inventory refreshes every 15 seconds; guest availability uses events with polling fallback.
5. A stale count is refused if an order or another staff member changed the item. Reopen it, recount/review, and submit a new adjustment. Never blindly retry an old absolute count.
6. End the shift with a physical count and investigate discrepancies. Cancellation does not automatically return prepared food to stock. A responsible staff member must confirm whether goods are reusable and enter an explicit adjustment with a reason. The complete KDS cancellation/fulfillment state workflow remains separate work.

Kitchen accounts can manage KITCHEN items; bar accounts can manage BAR items. Owners and managers can manage both. Waiters and guests cannot change stock. Staff cannot select a different venue in an inventory request.

## Read the dashboard

Choose Today, 7 days or 30 days. Today starts at midnight in Dar es Salaam and compares with yesterday's equivalent elapsed hours; its revenue chart compares with the same weekday last week. Rolling ranges compare equal preceding periods. Hour charts group the selected period into 24 local hour-of-day bins; they are not a daily time series.

| Figure | Definition |
| --- | --- |
| Collected revenue | Successful payment transactions completed in the period; excludes unpaid orders |
| Ordered sales | Placed order-item snapshot totals, excluding rejected/cancelled lines; excludes bill extras |
| Orders placed | Number of orders created in the period |
| Average bill | Rounded average gross bill total for non-void bills created in the period |
| Table turnover | Sessions closed in the period divided by currently active tables |
| Payment success | Successful / final completed attempts; pending attempts excluded |
| Waiter response | Mean seconds from call creation to acknowledgement, for acknowledged calls created in the period |

Missing observations display **No data**; zero previous values display **No previous data**, avoiding misleading percentages. A zero collection total is expected while the real payment integration is unavailable. No chart is populated with invented sales. Top sellers use order snapshots. Live floor uses actual sessions, locked splits and open waiter calls. The insights only count low-stock items and identify the busiest ordering hour; they do not predict demand.

Reports are scoped in SQL and cached in Redis for up to 45 seconds. **Refresh dashboard** requests a fresh calculation. **Export CSV** downloads summary figures, top-seller quantities and payment mix for the selected period. Charts use lightweight inline SVG; revenue also has an accessible data table. Guest, owner and staff bundles remain separate.

## Remaining operational gates

This update does not activate a payment aggregator, payout verification, email verification delivery, complete kitchen fulfillment/cancellation transitions, ingredient-level inventory, or production backups. Provider credentials/docs, independent security review, native PostgreSQL 16 CI results, physical foldable-device checks and PO acceptance remain release gates. Local browser width checks are useful but do not certify every device. Consult `LUXURY_DELIVERY_STATUS.md` and the deployment review for measured evidence.

## Run a shift

1. In **Owner > Team**, copy the displayed staff identifier. For a unique active name this is the person's name. If two people use the same name, a short suffix distinguishes their accounts. Give each person their own PIN. At **Staff**, enter the venue code, displayed name and PIN.
2. Open **Orders**. Kitchen and bar staff land here after sign-in. Each sees the items routed to their station. The waiter and manager see the whole venue. Use the status selector to find received, preparing, ready or served lines. Scroll the table horizontally on a narrow screen for the received time, served time and staff member who last handled each line.
3. On a station ticket, select **Accepted**, then **Preparing**, then **Ready** as work actually happens. The waiter selects **Served** at delivery. A manager can cover these actions. The ticket's overall progress follows its least advanced outstanding line. A physical preparation step always requires a staff action. The guest's device receives the resulting progress update.
4. In **Staff > Orders > Waiter requests**, read the guest's reason and message alongside the table. Select **On my way**, then **Mark resolved** when finished. The desk refreshes every five seconds and has a manual refresh button. The originating guest receives the acknowledgement.
5. On the venue dashboard, select a KPI card to compare the selected and previous period. **Orders placed** opens the actual orders from that reporting window. Live-floor tables stay in natural numeric label order as their status changes.
6. In **Menu > Add custom category**, name the category and choose its default station. An individual item can override that route. In **Tables & QR > Manage halls**, add or rename a hall. Renaming moves the hall's existing tables together. Select a table and use **Hall or zone > Save hall** to move just that table. Its existing QR stays valid.
7. Once an order is served, its guest can rate waiter service and each served kitchen line from 1 to 5, with an optional private comment. Owners and managers see feedback on the order. Available dishes with actual ratings appear under **Most rated food**, ordered by number of reviews and then average score. Repeat submission of the same order's feedback counts once.
8. **Your orders** and waiter messages belong to the participant on the guest's device. Returning with the same browser storage and valid device proof restores that participant while the table session is open. Clearing storage creates a new identity. **Table bill** remains shared for splitting the bill.
