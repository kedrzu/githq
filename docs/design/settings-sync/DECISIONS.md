# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

The product and its stack are decided in [the githq design](../githq/DECISIONS.md).

## D1

**Settings are stored in the user's own GitHub account, with no backend of ours. "Zero data retention" means nothing about
the user is held on our side; the data is the user's, in their repository.** (2026-11-01, owner)

**Why.** It follows the rule that GitHub is the only backend. The object that holds them is
[a private repository](#d6). The history of writes in that repository is the user's own and is not in conflict with this.

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

**After sign-in, on a device with no settings of its own, githq looks for saved settings and offers to load them if they
exist. The repository is created only when the user ticks the option to keep settings there, on the first-setup screen or
in settings, and both places explain it the same way.** (2026-11-01, owner)

**Why.** Follows from syncing being off by default ([D2](#d2)): nothing happens in someone's account without their asking.
A device that has local settings and syncing off is never interrupted; it looks for the repository when syncing is turned on.

**Rejected.**
- Proactively offering to create the repository when none is found ([history](history/DECISIONS.md#d3)) — it no longer
  fits a default of staying local.

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

## D9

**When syncing starts on a device that already has settings, the tracked lists are combined and, for any other setting set
on both sides, the saved one wins.** (2026-11-01, owner, on the design agent's proposal)

**Why.** Nothing the user tracks is lost, and untracking afterwards is one action.

**Rejected.**
- Replacing local settings with the saved ones — simpler, but silently removes repositories from the device along with
  their local copy.

## D10

**Turning syncing off stops syncing on this device, keeps the settings locally and leaves the repository in place. Removing
it happens on github.com, through a link from settings.** (2026-11-01, owner, on the design agent's proposal)

**Why.** The data is the user's ([D1](#d1)), and githq cannot delete a repository ([D6](#d6)).

**Rejected.**
- Asking for the `delete_repo` scope for a button in githq — it would widen the consent screen for everyone.

## D11

**One merge rule covers every case: the device keeps, next to its settings, the copy of the file it last saw and that copy's
`sha`, in the same `localStorage` place. What differs between the two is what it has not saved yet. Merging compares the
device's settings, the file now, and that copy: tracked items are added and removed by item, other settings by key, and when
both sides changed the same key the file wins. Order is the file's, with new items at the end.** (2026-11-01, proposal of the
design agent, not confirmed)

**Why.** First contact ([D9](#d9)) is this rule with an empty copy. A write refused with 409 is this rule after a re-read. A
response lost after a successful write merges to no change. A leader tab that closes loses nothing, because the next leader
finds the same difference on disk, so no queue of changes is needed. No device clock takes part. Any tab may change settings;
the leader tab writes, about 5 seconds after the last change (a guess, to be tuned), and asks about the file in its own sync
loop at the usual 60 s visible and 300 s hidden (`packages/app/sync/SyncEngine.ts:54-61`). Signing out tries to write first.

> **Checked 2026-11-01:** the app has no way to reorder tracked items (`packages/app/tracking/TrackingStore.ts:118-130`), so
> a reorder cannot conflict with an add today.

**Rejected.**
- Recording changes as a list of operations — a second structure that has to survive tab closes, for what the difference
  already gives.

## D12

**Anything that prevents syncing puts the device into one state, "syncing stopped": it keeps working from local settings,
never writes to the file, says why once and in settings, and offers to try again.** (2026-11-01, proposal of the design
agent, not confirmed)

**Why.** The reasons need no rule of their own: the repository was deleted (404), it exists without our file, so it isn't
ours, it is public when connecting, the file is unreadable or hand-edited into something invalid, its `version` is newer than this
build understands, creating it or writing to it is refused. Refusing to write to a file it cannot read means the file stays
recoverable. Visibility is checked when connecting, not on every poll.

## D13

**The file is `settings.json`: formatted JSON with a stable key order and a `version` number at the root, next to `repositories`
and `projects`, arrays in the user's order. Each entry nests its own settings: a repository its list options, a project its row
field and its options per saved view. My work's options sit at the root under `myWork`. Unknown keys are preserved when merging;
`version` goes up only for a change an older build can't safely ignore. Repositories keep today's identity (`owner/name`, with
the node id stored), projects their node ids.** (2026-11-01, owner for `version` and the root layout with nesting; the rest is a
proposal of the design agent, not confirmed)

```json
{
  "version": 1,
  "repositories": [
    { "nameWithOwner": "kedrzu/githq", "id": "R_kgDO…", "list": { "layout": "board", "sort": "updated" } }
  ],
  "projects": [
    {
      "id": "PVT_kw…", "owner": "kedrzu", "ownerKind": "user", "number": 1, "title": "Roadmap",
      "rowField": "PVTF_…",
      "views": { "PVTV_…": { "grouping": "status" } }
    }
  ],
  "myWork": { "grouping": "repository" }
}
```

**Why.** A reader on github.com gets a readable diff per change, and new optional settings don't stop older tabs.

**Consequence of nesting, not confirmed.** Settings exist in the file only for what is tracked. Today options are kept for any
repository page, tracked or not (`packages/app/repository/RepositoryPage.vue:66`). The agent's proposal: those of an untracked
repository stay local; tracking moves them into the file; untracking removes them with the entry. If one device untracks while
another edits that entry's settings, the removal wins.

**Rejected.**
- A separate `tracked` object with settings in a flat `lists` map by key ([history](history/DECISIONS.md#d13)) — owner.
- Keying everything by node id now — a repository page knows its name, not always its id, and all a rename costs is a list's
  display options, which is what happens today.

## Open questions

### Accepted risks, pending the owner's word

From the failure sweep of 2026-11-01:

- Turning syncing on brings back a repository untracked elsewhere while this device was off, because combining lists keeps no
  record of removals. The user untracks it again.
- Untracking by mistake and re-tracking moves the item to the end of the list, and the other device has already discarded
  its copy and downloads it again.
- Revoking githq's access on github.com ends in the existing sign-out on 401, which clears local settings
  (`packages/app/auth/AuthStore.ts:224-226`). Without syncing they are gone, as today.
- A renamed repository loses its display options and stays tracked under the old name until re-tracked.

### Project views' local changes now travel

> **Checked 2026-11-01:** `packages/app/lists/useListViewOptions.ts:30` shows a project view as "modified locally" and documents
> the options as local only, per D13 of [the githq design](../githq/DECISIONS.md#d13). With layout, grouping, sort and properties
> synced ([D7](#d7)), those changes follow the user. They still never reach GitHub's project.

The agent's proposal: the label becomes "modified", and nothing else changes.

### Where the last-view memory applies

The agent's proposal: the repository's tab and a project's saved view. A link with an explicit address always wins. Kept per
account in `localStorage`, cleared at sign-out.

### Order of building

The agent's proposal, each step usable by itself: settings in their own place, moving the tracked list out of the cache database,
plus the last view (no network); then loading, saving and merging behind the first-setup checkbox; then the settings screen.

> **Checked 2026-11-01:** `PUT …/contents/…` initialises an empty repository, and the REST API "will return a 409 Conflict if
> the Git repository is empty or unavailable", the latter while GitHub is still creating it —
> [Git database](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database). Not tested live:
> a test repository couldn't be removed afterwards, the `gh` token here has no `delete_repo`.
