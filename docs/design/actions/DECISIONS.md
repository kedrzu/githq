# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D1

**A workflow is broken for a ref pattern when its latest run on a ref matching that pattern, with a verdict,
failed. Runs that were cancelled or skipped give no verdict.** (2026-11-01, proposal of the design agent, not
confirmed by the owner)

**Why.** A run is one observation of a workflow, and a workflow can run on many refs: a green run on a feature
branch says nothing about `main`. Grouping by pattern and not by exact ref is what lets a one-shot tag recover.

> **Checked 2026-11-01 (live, `kedrzu/githq`, last 100 runs):** CLA 74 runs (events `issue_comment`,
> `pull_request_target`), 1 failed; Deploy 23 (`push`), 4 failed; Release 3 (`push`), 1 failed. A busy bot
> workflow takes most of a run list, and one page of runs can lose a rarely run workflow.

> **Checked 2026-11-01 (live, same repo):** Release ran on `v0.1.0-rc.1` failure, `v0.1.0-rc.2` cancelled,
> `v0.1.0-rc.3` success. Per exact ref, rc.1 would stay red forever because a tag never runs again; per pattern
> `v*` it recovers at rc.3. Deploy ran on both `main` and `chore/deploy-workflow`.

**Known cost.** Under `release/*`, a pass on `release/1.3` hides a failure on `release/1.2`. Accepted because the
owner's repositories do not keep parallel lines.

> **Checked 2026-11-01 (live, 24 repositories of `kedrzu` and `healedcare` pushed since May 2026):** branches
> starting with `release`: `kedrzu/nzyme`, `healedcare/healed` and `healedcare/sigma_backup` have one `release`;
> `kedrzu/slapss-app` has `release/2.0.1`, `kedrzu/cli` has `release/v4.0.0`. None has more than one.

**Rejected.**
- A workflow is broken when its latest finished run on any ref failed: a feature branch flips the state of
  `main` ([history](history/DECISIONS.md#d1)).
- One state per exact ref: a tag that failed never recovers.
- A feed of recent failed runs: a failure scrolls away while still broken, and a failure already fixed by a
  later run stays listed.
- The check rollup of the default branch's latest commit: a new green commit hides a broken nightly or deploy.

## D2

**Workflow state is read per repository over REST only: a conditional request on the repository's runs detects a
change, then conditional requests per workflow on `actions/workflows/{id}/runs` read the runs of the refs that
count. Workflows and runs are stored; "broken" is computed from them on read. No new OAuth scope.** (2026-11-01,
design agent, not confirmed by the owner)

**Why.** There is no cross-repository listing, and a 304 costs nothing against the primary allowance. REST is the
only API that can see which ref a run was on, and [D1](#d1) needs that. It departs from the project's "GraphQL
for fetching" principle because GraphQL cannot answer the question here.

> **Checked 2026-11-01:** run listing is per repository only —
> [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs). The repo events API has no workflow
> or check event types — [event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types).

> **Checked 2026-11-01 (live):** `GET /repos/kedrzu/githq/actions/runs?per_page=30` with `If-None-Match` →
> `304`, `core` remaining 4916 before and after two requests. A full answer is 362,166 bytes for 30 runs,
> about 12 KB per run, so the change-detecting request should ask for a small page.

> **Checked 2026-11-01 (live):** `actions/workflows/402954726/runs?branch=main&per_page=3` returned 3 runs in
> 43,788 bytes including headers, and its 304 left `core` unchanged. `branch=v0.1.0-rc.3` also matches the tag, with
> the tag name in `head_branch`. `branch=` is an exact match, so a wildcard pattern means filtering in the client
> and paging.

> **Checked 2026-11-01:** listing runs, reading job logs and re-running failed jobs need only `repo`, which
> githq already requests — [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs),
> [workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs),
> scopes in `packages/github/src/oauth.ts:40`.

**Rejected.**
- GraphQL `node(id:) { ... on Workflow { runs(first: n) } }` for reading runs: `runs` takes only paging and
  `orderBy`, and `WorkflowRun` has no head ref (`packages/github` schema; `checkSuite.branch` is `null` on a tag),
  so it cannot match a pattern. In a live read of CLA's latest 30 runs only 2 were on `main`, so the default
  branch's verdict falls out of the window ([history](history/DECISIONS.md#d2)).
- Storing a verdict per workflow and pattern: changing a pattern would have to invalidate it, and it can be computed.
- GitHub notifications as the source: the `ci_activity` reason covers only "A GitHub Actions workflow run that
  you triggered", which is the gap this design exists to close, and the endpoints are documented for classic
  personal tokens only ([notifications](https://docs.github.com/en/rest/activity/notifications), checked
  2026-11-01; not tried with an OAuth App token).

## D3

**The failure screen reads logs directly from the browser, and finds the failing place from the log itself.**
(2026-11-01, proposal of the design agent, not confirmed by the owner)

**Why.** It needs no server, in line with the rest of githq.

> **Checked 2026-11-01 (live, Chromium via Playwright, page on a foreign origin):** `fetch` of
> `GET /repos/kedrzu/githq/actions/jobs/124707179936/logs` with an `Authorization` header → 200, redirected to
> `productionresultssa16.blob.core.windows.net`, 176,562 characters readable. The redirect link "expires after
> 1 minute" ([workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs)), so it is fetched per read.

> **Checked 2026-11-01 (live, same job):** the log has 2,086 lines and one `##[error]` line, at 2070, which
> carries the step's final message. The failed check run's annotation repeats that message but says
> `start_line` 839, which is an unrelated line of the log, so annotations cannot locate the failure. The jobs
> endpoint names the failed step (`Run tauri-apps/tauri-action@v0`).

> **Checked 2026-11-01:** no log streaming endpoint is documented for a running job; the logs endpoint returns
> a plain-text file — [workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs).

**Rejected.**
- Check-run annotations as the pointer into the log: see the check above.

## D4

**Only tracked repositories are covered.** (2026-11-01, owner)

**Why.** The owner's call. It reuses the set githq already polls (`packages/app/tracking/TrackingTypes.ts`).

**Rejected.**
- A separate list of repositories watched for Actions only: the owner does not need it.

## D5

**Each repository has ref patterns with wildcards, which decide what lights the counters and nothing else.
Everything stays visible in the repository's workflow list.** (2026-11-01, owner for per-repository wildcards
and for turning off counters; "counters only" as the owner's wording read by the design agent, not confirmed)

**Why.** The owner's example: no counters for feature branches, or counters only on `main` and release. If a
wrong pattern only silences a counter, it cannot hide a failure from someone looking for it.

**Default: the repository's default branch only, without runs started by a pull request. Anything else is added
in the repository's settings.** (2026-11-01, owner)

Consequence: a failed release on a tag lights nothing until the repository's settings add `v*`, as in this
repository's own Release workflow ([D1](#d1)). It is still visible in the Workflows tab.

**Patterns live in a settings store the app treats as a black box: synchronised or local, per repository.**
(2026-11-01, owner) That store is being designed separately (branch `design/settings-sync-gist`); this design only
reads and writes settings through it and depends on nothing else about it.

**Rejected.**
- Default branch, `release`, `release/*` and all tags as the default: the owner says few people work that way.

> **Checked 2026-11-01:** the local database is no place for them: it is deleted and rebuilt on any schema version
> change (`packages/app/store/IndexedDbPersistence.ts:24-29`, `:323`).

## D6

**Failing workflows are reached three ways: a Workflows tab in the repository view at `/owner/name/actions`, a
red marker on the repository's sidebar row, and one cross-repository entry in the sidebar with a total.**
(2026-11-01, owner)

**Why.** Per-repository views answer "what is in this repository"; the owner's problem is not knowing which
repository. With many tracked repositories a red row can sit below the fold, and the collapsed rail shows no
repositories at all (`packages/app/shell/Sidebar.vue:276-322`), so a total is needed. Tabs for issues and pull
requests already exist on the same page (`packages/app/tracking/trackingRoutes.ts:14`).

**Rejected.**
- Broken workflows also in the repository's All tab, in a block above the items: the owner dropped it for now,
  workflows stay in their own tab ([history](history/DECISIONS.md#d8)).
- A nested sidebar menu per repository: several rows per repository to carry one fact, on a sidebar that already
  grows with every tracked repository.
- Issues, pull requests and workflows in columns on the repository page: a workflow has no fields, assignees or
  board groups, so it shares none of the list's keyboard and view behaviour, and three lists fight for width.

## D7

**The Workflows tab lists all of the repository's workflows, passing ones too, one row per workflow with its
recent runs, instead of GitHub's single chronological feed.** (2026-11-01, owner)

**Why.** The owner: failing workflows are buried, runs are mixed together, and failures on pull requests and
checks are not tied to a commit you would look at, so finding them means going through the Actions tab.

## D9

**Nothing silences a broken workflow: it stays red until a run passes.** (2026-11-01, owner)

**Why.** The owner's call for now. With workflows only in their own tab, a long-broken one costs a red marker and
a higher total, not space on the list of issues.

**A workflow disabled on GitHub does not count.** (2026-11-01, owner) It no longer runs and could never go green.

**Rejected.**
- A mute setting in githq, kept locally: not wanted now.

## D10

**Re-running failed jobs is a command in the command menu, not a single key.** (2026-11-01, owner)

**Why.** It starts something in the repository, so it should not be one stray keystroke away. It needs only the
`repo` scope ([D2](#d2)).

**Rejected.**
- A single-key shortcut on the failure screen.

## D11

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
