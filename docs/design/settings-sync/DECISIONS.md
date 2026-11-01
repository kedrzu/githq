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

**githq remembers the last tab per repository on the device, separately from the settings, so that coming back to a repository
opens the same tab (Issues or Pull requests).** (2026-11-01, owner)

> **Checked 2026-11-01:** nothing does this today. The tab lives only in the address
> (`packages/app/repository/RepositoryPage.vue:59-64`) and sidebar links use the repository's base path
> (`packages/app/layouts/shell.vue:83`).

**Rejected.**

- Remembering a project's saved view as well ([history](history/DECISIONS.md#d5)) — the design agent's extension, nobody asked
  for it.

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
The permission lines on the landing page (`packages/app/landing/LandingPermission.loc.yaml`) and the desktop sign-in
(`packages/app/desktop/DesktopSignIn.loc.yaml`) say githq also touches, if asked, its own settings repository.

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

**Synced: only which repositories and projects are tracked. Local: everything about views, meaning a list's layout, grouping,
sort, visible properties and filter, a project's row field, the last view, how items open, sidebar and panel sizes, plus new issue
drafts and approval request clicks.** (2026-11-01, owner; the row field counted as a view detail is the design agent's reading)

**Why.** View details are very volatile, so they stay in the browser. Predefined views saved in the settings repository may come
later; they are not part of this design.

|State|Where today (`packages/app/`)||
|-|-|-|
|Tracked repositories and projects|IndexedDB `meta.tracking`, `store/IndexedDbPersistence.ts:48`|synced|
|Layout, grouping, sort, visible properties, filter|`githq.listViews.<login>`, `lists/ListViewOptionsStore.ts:12`|local|
|Row field per project|IndexedDB `projects[].rowFieldId`, `projects/ProjectPersistence.ts:9`|local|
|How items open (panel, modal, page)|`githq.itemArrangement`, `services/LocalPreferences.ts:11`|local|
|Sidebar collapsed, panel widths|`services/LocalPreferences.ts:12-13`|local|
|New issue drafts, approval request clicks|`newIssue/NewIssueComposer.ts:20`, `tracking/ApprovalRequests.ts:12`|local|

No other per-user setting exists today (the app is dark only, `styles/tokens.scss:4`). The "modified locally" label on a project
view stays true and stays as it is.

**Rejected.**

- Syncing layout, grouping, sort, visible properties and the row field ([history](history/DECISIONS.md#d7)) — too volatile (owner).
- Synchronising how items open — owner, 2026-11-01.

## D8

**The tracked list is not cache: it stays local by default, survives a change of the cache database's schema, and is cleared at
sign-out with the rest. Where exactly it is kept is the implementer's call; the owner's default is `localStorage`.** (2026-11-01,
owner)

> **Checked 2026-11-01:** a schema version bump drops every IndexedDB store with no migration, the tracked list included
> (`packages/app/store/IndexedDbPersistence.ts:25-29`, `:333-337`), which sends the user back through the choice. Sign-out also
> deletes `createAccountSlot` keys (`packages/app/auth/createAccountSlot.ts:46-48`).

## D9

**When syncing starts on a device that already has settings, the tracked lists are combined and, for any other setting set
on both sides, the saved one wins.** (2026-11-01, owner, on the design agent's proposal)

**Why.** Nothing the user tracks is lost, and untracking afterwards is one action. A repository the file marks `tracking: false`
([D13](#d13)) counts as set on both sides, so it ends untracked here too; only one the file doesn't mention is added.

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
device's settings, the file now, and that copy, key by key, matching array entries by identity; when both sides changed the same
key the file wins. Order is the file's, with new entries at the end. Nothing is ever removed.** (2026-11-01, owner, on the design agent's
proposal)

**Why.** First contact ([D9](#d9)) is this rule with an empty copy. A write refused with 409 is this rule after a re-read. A
response lost after a successful write merges to no change. A leader tab that closes loses nothing, because the next leader
finds the same difference on disk, so no queue of changes is needed. No device clock takes part. The tab that made a change writes
it at once, and every tab reads the file when the app starts and when the tab regains focus, with a conditional request, free when
nothing changed. A write that failed is still the same difference, so the next read retries it.

> **Checked 2026-11-01:** the app has no way to reorder tracked items (`packages/app/tracking/TrackingStore.ts:118-130`), so
> a reorder cannot conflict with an add today.

**Rejected.**

- Checking the file in a loop at 60 s visible and 300 s hidden, writing about 5 seconds after a change through the leader tab, and
  writing at sign-out ([history](history/DECISIONS.md#d11)) — tracking changes rarely, and a stale write is refused anyway. All it
  buys is an open, unfocused device updating sooner (owner).
- Recording changes as a list of operations — a second structure that has to survive tab closes, for what the difference
  already gives.

## D12

**Anything that prevents syncing puts the device into one state, "syncing stopped": it keeps working from local settings,
never writes to the file, says why once and in settings, and offers to try again.** (2026-11-01, owner, on the design
agent's proposal)

**Why.** The reasons need no rule of their own: the repository was deleted (404), it exists without our file, so it isn't
ours, it is public when connecting, the file is unreadable or hand-edited into something invalid, its `version` is newer than this
build understands, creating it or writing to it is refused. Refusing to write to a file it cannot read means the file stays
recoverable. Visibility is checked when connecting, not on every poll. An empty private repository with the name (no commits, as a creation whose first write
never landed leaves it) is githq's own: turning on writes the file into it. A repository with commits and no file is not ours.

## D13

**The file is `settings.json`: formatted JSON with a stable key order, a `version` number at the root, next to `repositories` and
`projects`, arrays in the user's order. An entry says what it is and whether it is tracked, `tracking: true`; entries are never
removed, because repositories will have settings of their own later and untracking must not throw them away, and so that an
untracked item doesn't come back when lists are combined. `version` goes up with any new field, and a build that meets a higher number stops syncing ([D12](#d12)) until reloaded.**
(2026-11-01, owner for `version`, the root layout and `tracking`; projects the same way as repositories, owner; the rest is the
design agent's proposal)

```json
{
  "version": 1,
  "repositories": [
    { "nameWithOwner": "kedrzu/githq", "id": "R_kgDO…", "tracking": true },
    { "nameWithOwner": "acme/api", "id": "R_kgDO…", "tracking": false }
  ],
  "projects": [
    { "id": "PVT_kw…", "owner": "kedrzu", "ownerKind": "user", "number": 1, "title": "Roadmap", "tracking": true }
  ]
}
```

**Why.** A reader on github.com gets a readable diff per change, and an older tab can't overwrite a field it doesn't know. A repository tracked again returns to its old place in the sidebar, which is the entries with `tracking: true`, in
order.

**Rejected.**

- A separate `tracked` object, and per-list options nested in entries or in a `lists` map ([history](history/DECISIONS.md#d13)) —
  owner; view details are local ([D7](#d7)).
- Removing an entry on untrack and keeping only what is tracked — repositories will have settings later, which must survive
  untracking (owner).
- Preserving unknown keys so older tabs keep syncing past a new field ([history](history/DECISIONS.md#d13)) — nothing to preserve
  until a second kind of setting exists, and reloading is cheap.
- Keying repositories by node id — the app identifies them by name throughout
  (`packages/app/tracking/TrackingStore.ts:144`), and the id is stored if renames turn out to matter.

## D14

**Accepted risks.** (2026-11-01, owner)

- A repository marked untracked in the file and tracked here since, with syncing off, ends untracked when syncing is turned on,
  with its local copy.
- Untracking by mistake: the other device has already discarded its copy, and downloads it again after re-tracking.
- Revoking githq's access on github.com ends in the existing sign-out on 401, which clears local settings
  (`packages/app/auth/AuthStore.ts:224-226`). Without syncing they are gone, as today.
- A renamed repository stays in the file under its old name. What tracking does then was not checked.

The order of building is the implementer's call (owner). First write to an empty repository was not tested live; the implementer
checks it.

> **Checked 2026-11-01:** `PUT …/contents/…` initialises an empty repository, and the REST API "will return a 409 Conflict if
> the Git repository is empty or unavailable", the latter while GitHub is still creating it —
> [Git database](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database).

> **Checked 2026-11-01 (live, creating kedrzu/githq-settings):** `POST /user/repos` (private, `auto_init: false`), then
> `PUT …/contents/settings.json` without `sha` two seconds later → 201, the repository initialised. `PUT` without `sha` on an
> existing file → 422 ""sha" wasn't supplied"; with a stale `sha` → 409. Both are read again and merged. CORS preflight
> from `http://localhost:8787` for `POST /user/repos` and `PUT …/contents/…` → 204, `allow-origin: *`.

## D15

**Settings is one screen, reached from the command menu and from the menu on the signed-in user. It is the only place to start
tracking a repository or project: the `+` buttons and "Track repositories…" in the sidebar go. With no tracked project the sidebar
shows no Projects section. The signed-in user moves to the bottom of the sidebar, and the top carries the logo, the signet when
collapsed.** (2026-11-01, owner; that this also removes the offers to track on an untracked repository's and project's own screen,
and the "Track repositories…" command, is the design agent's reading of "no track buttons", and untracking from a tracked item's
menu stays)

**Why.** Owner's call on the shape of the app, made together with the settings screen this design introduces. It changes what
[the screens of the first sign-in path](../githq/ui/first-sign-in.md) describe. A list opened for an untracked repository still works.

> **Checked 2026-11-01:** what goes today: `packages/app/shell/Sidebar.vue:189-193`, `:228-232`, `:265-273`, `:316-321`; the offers on
> `packages/app/repository/RepositoryPage.vue:211` and `packages/app/projects/ProjectPage.vue:484`; the command in
> `packages/app/commands/AppCommands.loc.yaml:15`. `/settings` is today the account page and `/settings/tracking` the tracking screen
> (`packages/app/app/router.options.ts:85-103`).
