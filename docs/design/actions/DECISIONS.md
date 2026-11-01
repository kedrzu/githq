# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D1

**A workflow is broken when its latest finished run failed; the overview lists workflows, not runs or
commits.** (2026-11-01, proposal of the design agent, not confirmed by the owner)

**Why.** A run is one observation of a workflow. A failed nightly or deploy stays broken after later runs of
other workflows and after new green commits.

> **Checked 2026-11-01 (live, `kedrzu/githq`, last 100 runs):** CLA 74 runs (events `issue_comment`,
> `pull_request_target`), 1 failed; Deploy 23 (`push`), 4 failed; Release 3 (`push`), 1 failed. Failed Release
> run `41258592915` has `head_branch` `v0.1.0-rc.1`, a tag, so a default-branch filter would drop it; it was
> followed by a successful run on a later tag. A busy bot workflow takes most of a run list, and one page of
> runs can lose a rarely run workflow.

**Rejected.**
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
