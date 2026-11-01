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

**Open.** The default before any configuration. Proposal: the default branch, `release`, `release/*` and all tags, without runs started
by a pull request; the plain `release` branch and `release/*` are there because of the check under
[D1](#d1). Where patterns are stored: see the check below.

> **Checked 2026-11-01:** the tracked list lives in the `meta` store of the local database
> (`packages/app/store/IndexedDbPersistence.ts:233`), which is deleted and rebuilt on any schema version change
> (`:24-29`, `:323`), and it does not follow the user to another device. Patterns kept there would be lost the
> same way. Repository view options are also "kept on this device" (`packages/app/repository/RepositoryPage.vue:1`);
> where those live was not checked.

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

**Open.** Whether a workflow disabled on GitHub still counts. Proposal of the design agent, not confirmed: it does
not, because it no longer runs and could never go green.

**Rejected.**
- A mute setting in githq, kept locally: not wanted now.
