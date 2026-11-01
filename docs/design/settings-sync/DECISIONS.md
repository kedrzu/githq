# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

The product and its stack are decided in [the githq design](../githq/DECISIONS.md).

## D1

**Settings are stored in the user's own GitHub account, with no backend of ours and nothing retained by
us.** (2026-11-01, owner)

**Why.** It follows the rule that GitHub is the only backend. Which GitHub object holds them is
[still open](#open-questions); the owner's first choice is a gist.

## D2

**Syncing is optional and on by default. It is offered during first setup and on a new settings screen.**
(2026-11-01, owner)

**Why.** Owner's call. There is no preferences screen today: `/settings` is the account page
(`packages/app/account/AccountPage.vue`), and the first-setup step is `TrackingChoicePage`, reached through the
redirect in `packages/app/auth/routeAccess.ts:105-120`.

## D3

**After sign-in githq looks for saved settings. If it finds them it offers to load them; if not, it offers to
create them and start syncing.** (2026-11-01, owner)

## D4

**Synced: the list of tracked repositories, per-repository settings, other per-user settings. Local only:
what the user is currently viewing.** (2026-11-01, owner)

**Why.** Owner's distinction: a preference of the user travels, a preference of the view does not. Where
display options fall is [still open](#open-questions).

## D5

**githq remembers the last view per repository on the device, separately from the settings, so that coming
back to a repository opens the same tab (Issues or Pull requests).** (2026-11-01, owner)

> **Checked 2026-11-01:** nothing does this today. The tab lives only in the address
> (`packages/app/repository/RepositoryPage.vue:59-64`) and sidebar links use the repository's base path
> (`packages/app/layouts/shell.vue:83`).

## Open questions

### What holds the settings: a secret gist or a private repository

The owner's first choice is a gist; the stated reason, no backend of our own, is met by both.
The agent's proposal, not confirmed: a private repository with a fixed name in the user's account.

A gist needs a new scope, and needs it at every sign-in, because detection (D3) has to see secret gists
before the user has chosen anything.

> **Checked 2026-11-01:** scopes today are `repo project read:org` (`packages/github/src/oauth.ts:41`).
> "To read or write gists on a user's behalf, you need the gist OAuth scope and a token" —
> [Gists](https://docs.github.com/en/rest/gists/gists). `GET /gists` includes secret gists "only … if the token
> has the gist scope" — [GitHub bounty note, 2015](https://bounty.github.com/2015/06/30/gist-api-authz.html),
> the only explicit statement found; not tested live. Stored tokens are never re-checked for scopes
> (`hasOAuthScopes` runs only in `completeSignIn`, `packages/app/auth/AuthStore.ts:175`), so existing users would
> need a way back through consent. The landing page's permission line
> (`packages/app/landing/LandingPermission.loc.yaml:2`) says githq "only touches issues, pull requests and
> projects"; either storage makes that untrue and it has to change.

A secret gist is not private.

> **Checked 2026-11-01:** "Secret gists aren't private… if someone you don't know discovers the URL, they'll
> also be able to see your gist." — [Creating gists](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
> The tracked list holds the names of private repositories (`packages/app/tracking/TrackingTypes.ts:4-31`).

A gist has no unique name and no server-side lookup, so finding one means reading through all of the user's gists.

> **Checked 2026-11-01:** `GET /gists` takes only `since`, `per_page` (max 100) and `page`; each listed file has
> `filename` but no `content`. No REST search for gists exists ([Search](https://docs.github.com/en/rest/search/search)),
> and GraphQL `viewer.gists` filters only on `privacy`. If gists win, the proposal is to identify ours by a fixed
> filename, then keep its ID on the device.

A gist write cannot detect that another device wrote first; a repository file write can.

> **Checked 2026-11-01:** "Conditional requests for unsafe methods, such as POST, PUT, PATCH, and DELETE are not
> supported unless otherwise noted" — [Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api);
> the gist `PATCH` notes nothing. `PUT /repos/{o}/{r}/contents/{path}`: `sha` is "Required if you are updating a
> file. The blob SHA of the file being replaced", and the endpoint lists 409 Conflict —
> [Contents](https://docs.github.com/en/rest/repos/contents). Rejecting a stale `sha` with 409 is the documented
> shape, not tested live.

Both keep a history of every write, so on either one removing old settings means deleting the whole object.

> **Checked 2026-11-01:** "Every gist is a Git repository" — [Creating gists](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
> Not found in the docs: whether deleting a gist removes its revisions, how long they are kept.

What the repository costs: an extra repository in the user's account, which githq must hide from its own lists,
and it feels heavier than a gist. It does not touch the public profile by default.

> **Checked 2026-11-01:** "By default, your contribution graph and Achievements only show activity from public
> repositories." — [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile).

Common to both, and fine: browser access and free unchanged checks.

> **Checked 2026-11-01:** CORS preflight with `Origin: https://githq.dev` returned 204 and `allow-origin: *` for
> `PUT /repos/…/contents/…`, and for `PATCH /gists/…` with `If-None-Match` allowed. A 304 "does not count against
> your primary rate limit" — [Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api);
> not tested on these two endpoints. Content-creating requests are capped at 80 per minute and 500 per hour —
> [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

### Several sets of settings on one account

Only matters if the settings live in a gist. Is it an accident to recover from, such as two devices set up at the
same time, or a feature, such as separate work and private settings? The agent's proposal: an accident. Show the
ones found with their last change and number of repositories, let the user pick, and remember the ID on the device.

### Which existing state travels

What the code keeps today, none of it decided yet except the tracked list:

| State | Where (`packages/app/`) | Proposal |
|---|---|---|
| Tracked repositories and projects | IndexedDB `meta.tracking`, `store/IndexedDbPersistence.ts:48` | synced (D4) |
| Layout, grouping, sort, visible properties per list | `githq.listViews.<login>`, `lists/ListViewOptionsStore.ts:12` | synced |
| Row field per project | IndexedDB `projects[].rowFieldId`, `projects/ProjectPersistence.ts:9` | synced |
| Filter per list | same key as layout, `lists/useListViewOptions.ts:39-45` | local: changes constantly, and each synced change is a commit |
| Item arrangement (panel, modal, page) | `githq.itemArrangement`, `services/LocalPreferences.ts:11` | undecided |
| Sidebar collapsed, panel widths | `services/LocalPreferences.ts:12-13` | local |
| New issue drafts, approval request clicks | `newIssue/NewIssueComposer.ts:20`, `tracking/ApprovalRequests.ts:12` | local |

### The tracked list sits inside the cache database

> **Checked 2026-11-01:** a schema version bump drops every IndexedDB store with no migration, the tracked list and
> row fields included (`packages/app/store/IndexedDbPersistence.ts:25-29`, `:333-337`), which sends the user back through
> the choice. This contradicts the rule that what is stored locally can be rebuilt from GitHub.

Whatever is decided above, the settings need a home of their own outside the cache database, for users with
sync off too.

### Not yet discussed

First contact on a device that already has local settings (replace or merge). What happens to the data when sync
is turned off. Write timing, and how changes from another device arrive. The format of the stored file and
versions of it, which is the hard part to change once written. Where the last-view memory applies besides the
repository tab.
