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

## D5

Retired 2026-11-01, narrowed in [D5](../DECISIONS.md#d5).

**githq remembers the last view per repository on the device, separately from the settings, so that coming
back to a repository opens the same tab (Issues or Pull requests). A project's saved view is remembered the same way. An address
with an explicit tab or view always wins.** (2026-11-01, owner; the project view and the address rule are the design agent's
reading of "view details stay local")

> **Checked 2026-11-01:** nothing does this today. The tab lives only in the address
> (`packages/app/repository/RepositoryPage.vue:59-64`) and sidebar links use the repository's base path
> (`packages/app/layouts/shell.vue:83`).

## D7

Retired 2026-11-01, view details became local in [D7](../DECISIONS.md#d7).

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

Retired 2026-11-01, sharpened in [D8](../DECISIONS.md#d8).

**Settings have their own place in `localStorage`, per account, outside the cache database, whether syncing is on or
off.** (2026-11-01, owner for `localStorage` as the default; the per-account key is the design agent's proposal,
following `packages/app/auth/createAccountSlot.ts`)

**Why.** The cache database is meant to be disposable, and the tracked list inside it is not.

> **Checked 2026-11-01:** a schema version bump drops every IndexedDB store with no migration, the tracked list and row
> fields included (`packages/app/store/IndexedDbPersistence.ts:25-29`, `:333-337`), which sends the user back through
> the choice. Sign-out also deletes `createAccountSlot` keys (`packages/app/auth/createAccountSlot.ts:46-48`), so with
> syncing off, signing out still forgets the settings, as it does today.

## D11

Retired 2026-11-01, timing changed in [D11](../DECISIONS.md#d11).

**One merge rule covers every case: the device keeps, next to its settings, the copy of the file it last saw and that copy's
`sha`, in the same `localStorage` place. What differs between the two is what it has not saved yet. Merging compares the
device's settings, the file now, and that copy, key by key, matching array entries by identity; when both sides changed the same
key the file wins. Order is the file's, with new entries at the end. Nothing is ever removed.** (2026-11-01, owner, on the design agent's
proposal)

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

Retired 2026-11-01, `tracking` added in [D13](../DECISIONS.md#d13).

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

Retired 2026-11-01, view details removed in [D13](../DECISIONS.md#d13).

**The file is `settings.json`: formatted JSON with a stable key order and a `version` number at the root, next to `repositories`
and `projects`, arrays in the user's order. Each entry nests its own settings: a repository its list options, a project its row
field and its options per saved view. Whether something is tracked is one of those settings, `tracking: true`; entries are never
removed, so untracking keeps the rest. Projects work the same way as repositories. My work's options sit at the root under `myWork`. Unknown keys are preserved when merging;
`version` goes up only for a change an older build can't safely ignore. Repositories keep today's identity (`owner/name`, with
the node id stored), projects their node ids.** (2026-11-01, owner for `version`, the root layout with nesting and `tracking` on a
repository; the rest is a proposal of the design agent, not confirmed)

```json
{
  "version": 1,
  "repositories": [
    { "nameWithOwner": "kedrzu/githq", "id": "R_kgDO…", "tracking": true, "list": { "layout": "board", "sort": "updated" } },
    { "nameWithOwner": "acme/api", "tracking": false, "list": { "sort": "created" } }
  ],
  "projects": [
    {
      "id": "PVT_kw…", "owner": "kedrzu", "ownerKind": "user", "number": 1, "title": "Roadmap", "tracking": true,
      "rowField": "PVTF_…",
      "views": { "PVTV_…": { "grouping": "status" } }
    }
  ],
  "myWork": { "grouping": "repository" }
}
```

**Why.** A reader on github.com gets a readable diff per change, and new optional settings don't stop older tabs.

**Consequences.** A repository gets an entry when it is tracked or when one of its options changes, so options of untracked
repositories travel too (`packages/app/repository/RepositoryPage.vue:66` keeps them for any repository page today), and the file
grows only by repositories someone adjusted. `id` is optional, because a repository page doesn't always know it. A repository
tracked again returns to its old place in the sidebar, which is the entries that have `tracking: true`, in order.

**Rejected.**
- A separate `tracked` object with settings in a flat `lists` map by key ([history](history/DECISIONS.md#d13)) — owner.
- Entries only for tracked repositories, removed on untrack, with other options local ([history](history/DECISIONS.md#d13)) —
  untracking would throw settings away (owner).
- Keying everything by node id now — a repository page knows its name, not always its id, and all a rename costs is a list's
  display options, which is what happens today.

Retired 2026-11-01, unknown keys dropped in [D13](../DECISIONS.md#d13).

**The file is `settings.json`: formatted JSON with a stable key order, a `version` number at the root, next to `repositories` and
`projects`, arrays in the user's order. An entry says what it is and whether it is tracked, `tracking: true`; entries are never
removed, so settings added to an entry later survive untracking, and an untracked item doesn't come back when lists are
combined. Unknown keys are preserved when merging; `version` goes up only for a change an older build can't safely ignore.**
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

**Why.** A reader on github.com gets a readable diff per change, and new optional settings, such as predefined views, don't stop
older tabs. A repository tracked again returns to its old place in the sidebar, which is the entries with `tracking: true`, in
order.

**Rejected.**
- A separate `tracked` object, and per-list options nested in entries or in a `lists` map ([history](history/DECISIONS.md#d13)) —
  owner; view details are local ([D7](#d7)).
- Removing an entry on untrack — it would forget that the user untracked it (owner).
- Keying repositories by node id — the app identifies them by name throughout
  (`packages/app/tracking/TrackingStore.ts:144`), and the id is stored if renames turn out to matter.
