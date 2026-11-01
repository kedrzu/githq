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

## D2

Retired 2026-11-01, replaced by the current [D2](../DECISIONS.md#d2): GraphQL cannot see a run's ref.

**Workflow state is read per repository: conditional REST to detect a change, then the latest runs of each
workflow; no new OAuth scope.** (2026-11-01, proposal of the design agent, not confirmed by the owner)

**Why.** There is no cross-repository listing, and a 304 costs nothing, so polling tracked repositories at the
existing 60s interval costs only when something changed.

> **Checked 2026-11-01:** run listing is per repository only —
> [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs). The repo events API has no workflow
> or check event types — [event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types).

> **Checked 2026-11-01 (live):** `GET /repos/kedrzu/githq/actions/runs?per_page=30` with `If-None-Match` →
> `304`, `core` remaining 4916 before and after two requests. A full answer is 362,166 bytes for 30 runs,
> about 12 KB per run, so a changed repository is heavy to re-read over REST.

> **Checked 2026-11-01 (live):** GraphQL `Repository` has no workflow or run field, but
> `node(id: <workflow node id>) { ... on Workflow { runs(first: n) { ... } } }` works, and two workflows in one
> query cost 1 point. Workflow node ids come from `GET /repos/{o}/{r}/actions/workflows`. `checkSuite.branch`
> is `null` for a run on a tag, and the latest run can be `IN_PROGRESS`, so `first: 1` is not enough to find the
> latest finished one.

> **Checked 2026-11-01:** listing runs, reading job logs and re-running failed jobs need only `repo`, which
> githq already requests — [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs),
> [workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs),
> scopes in `packages/github/src/oauth.ts:40`.

**Rejected.**
- GitHub notifications as the source: the `ci_activity` reason covers only "A GitHub Actions workflow run that
  you triggered", which is the gap this design exists to close, and the endpoints are documented for classic
  personal tokens only ([notifications](https://docs.github.com/en/rest/activity/notifications), checked
  2026-11-01; not tried with an OAuth App token).

## D11

Retired 2026-11-01, replaced by [D12](../DECISIONS.md#d12): the owner dropped reading logs ahead.

**When a workflow turns red, githq reads its failed jobs and their logs ahead of time and keeps them locally, as
low-priority work.** (2026-11-01, owner)

**Why.** Opening a failure without waiting is the point of the screen, but the owner expects a lot of sync running
in time, so this must not compete with it.

> **Checked 2026-11-01:** there is no shared priority across sync work. The five loops run independently
> (`packages/app/sync/SyncEngine.ts:54-61`); `DetailPrefetch` stays out of the way by itself: one batch at a time,
> 2s between batches, off while hidden, stops under 500 GraphQL points (`packages/app/sync/DetailPrefetch.ts:17-24`).
> Only GraphQL has a reserve for edits (`packages/app/sync/getAllowancePause.ts:10`); logs draw on `core`, which has
> none.

> **Checked 2026-11-01:** secondary limits are "No more than 100 concurrent requests" and "no more than 900 points
> per minute" per REST endpoint, with a `GET` at 1 point. The page does not say whether a 304 counts —
> [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). Polling is
> sequential per repository (`packages/app/sync/TrackingSync.ts`).

> **Not tested 2026-11-01:** what the logs endpoint returns for a job still running; no run was in progress.

**Rejected.**
- Reading the log only on opening: every failure starts with a wait.

**How priority works: a separate background reader built like `DetailPrefetch`, with its own floor on `core`.**
(2026-11-01, owner)

**Also rejected.**
- A shared queue with priorities for all sync work: a rebuild of `SyncEngine`, with no two kinds of work competing
  for one bucket yet. Reopen when there is such a pair.
