# Retired decisions

Full text under the original IDs, oldest first. Never edited after being written.

## D1

Retired 2026-11-01, replaced by the current [D1](../DECISIONS.md#d1), which adds which refs count.

**A workflow is broken when its latest finished run failed; the overview lists workflows, not runs or
commits.** (2026-11-01, proposal of the design agent, not confirmed by the owner)

**Why.** A run is one observation of a workflow. A failed nightly or deploy stays broken after later runs of
other workflows and after new green commits.

**Rejected.**
- A feed of recent failed runs: a failure scrolls away while still broken, and a failure already fixed by a
  later run stays listed.
- The check rollup of the default branch's latest commit: a new green commit hides a broken nightly or deploy.

## D6

Retired 2026-11-01, replaced by the current [D6](../DECISIONS.md#d6), without the All tab.

**Failing workflows are reached four ways: a Workflows tab in the repository view at `/owner/name/actions`, the
repository's All tab ([D8](#d8)), a red marker on the repository's sidebar row, and one cross-repository entry in
the sidebar with a total.** (2026-11-01, owner)

**Why.** Per-repository views answer "what is in this repository"; the owner's problem is not knowing which
repository. With many tracked repositories a red row can sit below the fold, and the collapsed rail shows no
repositories at all (`packages/app/shell/Sidebar.vue:276-322`), so a total is needed. Tabs for issues and pull
requests already exist on the same page (`packages/app/tracking/trackingRoutes.ts:14`).

**Rejected.**
- A nested sidebar menu per repository: several rows per repository to carry one fact, on a sidebar that already
  grows with every tracked repository.
- Issues, pull requests and workflows in columns on the repository page: a workflow has no fields, assignees or
  board groups, so it shares none of the list's keyboard and view behaviour, and three lists fight for width.

## D8

Retired 2026-11-01: the owner dropped showing workflows in All for now; see [D6](../DECISIONS.md#d6).

**The repository's All tab also shows its broken workflows, in a block of their own above the issues and pull
requests.** (2026-11-01, owner for showing them in All; design agent for the block and the rules below, not
confirmed)

**Why.** The All tab is a list of items: grouped by milestone by default, filtered by open or closed, shown as a
list or a board, with items that can be dragged between groups (`packages/app/repository/RepositoryView.vue:1`,
`buildRepositoryList.ts`). A workflow has no milestone, state or assignee, so as a row it would have no group to
sit in and no meaning under those filters.

Proposed rules: the same set as the sidebar marker, so ref patterns apply ([D5](#d5)); shown whatever the
grouping, sort and open or closed filter; on the board, above the columns; not counted in the tab's item count;
reachable by the list's keyboard movement; no selection or bulk actions.

**Open.** Whether anything can silence a workflow that stays broken on purpose, since the block sits on top of
this tab until it passes. Proposal: no setting in githq; a workflow disabled on GitHub does not count.

**Rejected (proposed, owner has not decided).**
- Workflows as rows mixed among the items: see Why.
- All failures including runs from pull requests: bots and contributors' branches would fill the top of the tab,
  and those stay visible in the Workflows tab.
