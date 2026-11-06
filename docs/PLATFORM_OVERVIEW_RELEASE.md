# Platform overview redesign and publication check

## What changed

The overview follows the supplied `Cloud-Menu Platform overview.html`: eight KPI cards, three rule-based insight panels, hourly orders, venue status and lifecycle bars, real growth lines, sales comparison, billing-model meters, and a trial follow-up table. It uses the existing bilingual UI and bundled fonts. Controls remain accessible on small screens, foldable widths and enlarged text.

All figures come from application records. The reference's illustrative venue names, random growth series and sample financial numbers are not copied. Current venue status/model totals are distinct from period-based activity. All-time growth shows the latest 12 calendar months; other all-time totals retain full history. Times are East Africa Time.

Cards open venue filters, and trial rows open the existing venue detail, access and negotiated-billing controls. Legacy live access is included correctly when opening active venues.

## Why the earlier Render deployment did not show the agreed changes

Verified on 6 November 2026:

| Location | Commit | Meaning |
|---|---|---|
| GitHub `feature/luxury-venue-platform` | `06d507a7e99b91dc427664371201a7fc65f6b10f` | Previous venue-dashboard release |
| Render live deploy `dep-dbm5i6mc6qcc7382404g` | Same `06d507a` commit | Manual deployment on 5 November rebuilt the old remote code |
| Local earlier improvements | `acff9dd` | Venue filters, per-venue rates, and personal staff notification bells were committed but not published |
| Local redesign | Subsequent commit on the same branch | Includes the overview redesign and retains the earlier improvements |

A Render deploy can only build code already published to its configured GitHub branch. Clearing the browser cache or redeploying an unchanged branch cannot publish local commits. The latest Git push attempt failed to connect; the previous connector upload attempt was explicitly rejected by the corporate upload gateway. No new Render deployment was triggered during this redesign.

## Publish and verify

After GitHub upload access is restored through an authorized network/workstation setup:

1. In this repository, run `git status` and `git log -2 --oneline`. Preserve the unrelated local Word test guide.
2. Run `git push origin feature/luxury-venue-platform`.
3. Confirm GitHub's branch head matches `git rev-parse HEAD`, and both the overview redesign and `acff9dd` appear in its history.
4. In the existing **cloud-menu-staging** Render service, confirm the branch is `feature/luxury-venue-platform`. Choose **Manual Deploy → Deploy latest commit**.
5. Verify the deploy's commit matches the new GitHub head, not `06d507a`. Wait for **Live**, then check `/health` and `/ready` return healthy responses.
6. Check startup logs for successful migrations, including `0024_venue_billing.sql` and `0025_staff_notifications.sql`. Do not reset the database.
7. Sign in at `/admin/`: verify the new overview, period controls, real trial rows, venue filters, and per-venue billing form.
8. Use separate kitchen/bar/waiter accounts at `/staff/` to verify station routing and personal unread counts. Use the separate admin-and-notifications acceptance checklist.

This release does not introduce payment-provider charging, background push notifications, or personal waiter/table assignments. Native device acceptance and staging latency acceptance remain separate gates. No fresh Lighthouse result is claimed for this admin-only redesign.
