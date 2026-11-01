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

**Why.** It follows the rule that GitHub is the only backend. The object that holds them is
[a private repository](#d6).

## D2

**Syncing is optional and off by default: settings stay in the browser unless the user turns it on. It is
offered during first setup and on a new settings screen.** (2026-11-01, owner)

**Why.** Owner's call, made together with choosing a repository ([D6](#d6)): githq should not create a
repository in someone's account unless they asked for it. There is no preferences screen today: `/settings` is the
account page (`packages/app/account/AccountPage.vue`), and the first-setup step is `TrackingChoicePage`, reached
through the redirect in `packages/app/auth/routeAccess.ts:105-120`.

**Rejected.**
- On by default, with a ticked checkbox ([history](history/DECISIONS.md#d2)) — it would create a repository for
  everyone who just clicks through.

## D3

**After sign-in githq looks for saved settings. If it finds them it offers to load them; if not, it offers to
create them and start syncing.** (2026-11-01, owner)

**Why.** Owner's brief. How "offers to create" reads now that syncing is off by default is
[still open](#open-questions).

## D4

**Synced: the list of tracked repositories, per-repository settings, other per-user settings. Local only:
what the user is currently viewing.** (2026-11-01, owner)

**Why.** Owner's distinction: a preference of the user travels, a preference of the view does not. Applied to
today's state in [D7](#d7).

## D5

**githq remembers the last view per repository on the device, separately from the settings, so that coming
back to a repository opens the same tab (Issues or Pull requests).** (2026-11-01, owner)

> **Checked 2026-11-01:** nothing does this today. The tab lives only in the address
> (`packages/app/repository/RepositoryPage.vue:59-64`) and sidebar links use the repository's base path
> (`packages/app/layouts/shell.vue:83`).

## D6

**Synced settings live in a private repository with a fixed name in the user's account.** (2026-11-01, owner,
on the design agent's recommendation; the name `githq-settings` is the agent's proposal)

**Why.** It needs no new OAuth scope, it is actually private, one request by name finds it, and a write that
raced another device is refused rather than silently overwriting it.

> **Checked 2026-11-01 (live, on the branch of PR #49, nothing written):** `PUT …/contents/<file>` with a `sha` that
> doesn't match → `409 Conflict`, "… does not match 6fd2cd7…", branch head unchanged. `GET …/contents/<file>` returned
> an ETag, and repeating it with `If-None-Match` → `304`, `x-ratelimit-remaining` unchanged (4979 before and after).

> **Checked 2026-11-01:** CORS preflight with `Origin: https://githq.dev` for `PUT /repos/…/contents/…` → 204,
> `allow-origin: *`. Content-creating requests are capped at 80 per minute and 500 per hour —
> [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

Costs accepted: one more repository in the account, which githq has to hide from its own lists. It does not show on
the public profile by default. Every write is a commit, so history keeps old settings until the repository is deleted.
The landing page's permission line (`packages/app/landing/LandingPermission.loc.yaml:2`), "githq only touches issues,
pull requests and projects", has to change.

> **Checked 2026-11-01:** "By default, your contribution graph and Achievements only show activity from public
> repositories." — [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile).

githq cannot delete the repository with the scopes it has.

> **Checked 2026-11-01:** "OAuth app tokens and personal access tokens (classic) need the delete_repo scope to use this
> endpoint." — [Repositories](https://docs.github.com/en/rest/repos/repos). Today's scopes are `repo project read:org`
> (`packages/github/src/oauth.ts:41`).

**Rejected.**
- A secret gist, the owner's first idea. It needs the `gist` scope at every sign-in, for write access to all of the
  user's gists, because detection has to see them before anyone chooses anything. It is readable by anyone with the URL,
  while the settings hold names of private repositories. There is no unique name or server-side lookup, so finding one
  means reading all the user's gists, and several can exist. A write cannot detect that another device wrote first.

  > **Checked 2026-11-01:** "To read or write gists on a user's behalf, you need the gist OAuth scope and a token" —
  > [Gists](https://docs.github.com/en/rest/gists/gists). Secret gists are listed "only … if the token has the gist
  > scope" — [GitHub bounty note, 2015](https://bounty.github.com/2015/06/30/gist-api-authz.html), the only explicit
  > statement found. "Secret gists aren't private… if someone you don't know discovers the URL, they'll also be able to
  > see your gist." — [Creating gists](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
  > `GET /gists` takes only `since`, `per_page` (max 100) and `page`; GraphQL `viewer.gists` filters only on `privacy`.
  > "Conditional requests for unsafe methods, such as POST, PUT, PATCH, and DELETE are not supported unless otherwise
  > noted" — [Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

  Would win if a repository created by the app were unacceptable to users. Choosing among several same-named gists goes
  with it: with a fixed repository name, one account holds one set of settings.

## D7

**Synced: tracked repositories and projects; per list, its layout, grouping, sort and visible properties; the row field
per project. Local: a list's filter, the last view, how items open, sidebar and panel sizes, new issue drafts, approval
request clicks.** (2026-11-01, owner, on the design agent's proposal)

**Why.** A filter changes constantly and each synced change would be a commit, and it describes what the user is
looking at now.

| State | Where today (`packages/app/`) | |
|---|---|---|
| Tracked repositories and projects | IndexedDB `meta.tracking`, `store/IndexedDbPersistence.ts:48` | synced |
| Layout, grouping, sort, visible properties | `githq.listViews.<login>`, `lists/ListViewOptionsStore.ts:12` | synced |
| Row field per project | IndexedDB `projects[].rowFieldId`, `projects/ProjectPersistence.ts:9` | synced |
| Filter per list | same key as layout, `lists/useListViewOptions.ts:39-45` | local |
| How items open (panel, modal, page) | `githq.itemArrangement`, `services/LocalPreferences.ts:11` | local |
| Sidebar collapsed, panel widths | `services/LocalPreferences.ts:12-13` | local |
| New issue drafts, approval request clicks | `newIssue/NewIssueComposer.ts:20`, `tracking/ApprovalRequests.ts:12` | local |

**Rejected.**
- Synchronising how items open — owner, 2026-11-01.

## D8

**Settings have their own place in `localStorage`, per account, outside the cache database, whether syncing is on or
off.** (2026-11-01, owner for `localStorage` as the default; the per-account key is the design agent's proposal,
following `packages/app/auth/createAccountSlot.ts`)

**Why.** The cache database is meant to be disposable, and the tracked list inside it is not.

> **Checked 2026-11-01:** a schema version bump drops every IndexedDB store with no migration, the tracked list and row
> fields included (`packages/app/store/IndexedDbPersistence.ts:25-29`, `:333-337`), which sends the user back through
> the choice. Sign-out also deletes `createAccountSlot` keys (`packages/app/auth/createAccountSlot.ts:46-48`), so with
> syncing off, signing out still forgets the settings, as it does today.

## Open questions

### When is creating the repository offered

The agent's proposal: only an unticked checkbox on the first-setup screen and a switch in settings, with no prompt
elsewhere. githq looks for the repository when the device has no settings of its own, and when the user turns syncing
on. A device that already has local settings and syncing off is never interrupted.

### First contact when both sides have settings

The laptop tracks 5 repositories, the repository holds 12 from another computer, and the user turns syncing on. The agent's
proposal: tracked lists are combined, and for any other setting set on both sides the saved one wins. Nothing is lost,
and the user can untrack afterwards.

### Turning syncing off and removing the data

The agent's proposal: turning off stops syncing on this device, keeps settings locally and leaves the repository in place.
Removal is a link to the repository's settings page on github.com, because githq cannot delete it (D6). Asking for
`delete_repo` for this one button would widen the consent screen for everyone.

### Not yet discussed

A repository of that name already exists and isn't ours; it was made public or deleted by hand; creating it fails, for
instance on a managed enterprise account. Write timing, and how changes from another device arrive. The format of the
stored file and versions of it, which is the hard part to change once written. Where the last-view memory applies
besides the repository tab.
