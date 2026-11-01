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

## D13

Retired 2026-11-01, layout changed in [D13](../DECISIONS.md#d13).

**The file is `settings.json`, formatted JSON with a stable key order, carrying a `format` number. Unknown keys are preserved
when merging; the number goes up only for a change an older build can't safely ignore. Repositories keep today's keys
(`owner/name`), projects their node ids.** (2026-11-01, proposal of the design agent, not confirmed)

**Why.** A reader on github.com gets a readable diff per change, and new optional settings don't stop older tabs. Tracked
repositories also store their node id (`packages/app/tracking/TrackingTypes.ts:4-9`), so moving keys to ids later is a
one-way mapping if renames turn out to matter.

**Rejected.**
- Keying everything by node id now — a repository page knows its name, not always its id, and all a rename costs is a list's
  display options, which is what happens today.
