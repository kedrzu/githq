# Retired decisions

Full text of what no longer holds, under the original IDs. Not edited after it is written.

## D2

Retired 2026-11-01, default changed in [D2](../DECISIONS.md#d2).

**Syncing is optional and on by default. It is offered during first setup and on a new settings screen.**
(2026-11-01, owner)

**Why.** Owner's call. There is no preferences screen today: `/settings` is the account page
(`packages/app/account/AccountPage.vue`), and the first-setup step is `TrackingChoicePage`, reached through the
redirect in `packages/app/auth/routeAccess.ts:105-120`.

## D3

Retired 2026-11-01, narrowed in [D3](../DECISIONS.md#d3).

**After sign-in githq looks for saved settings. If it finds them it offers to load them; if not, it offers to
create them and start syncing.** (2026-11-01, owner)

**Why.** Owner's brief.
