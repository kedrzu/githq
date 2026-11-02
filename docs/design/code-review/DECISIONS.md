# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone,
so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes
from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is
not.

## D1

**githq writes reviews, not only reads them: line comments, replies, resolving threads, and submitting a review as
a comment, an approval or a request for changes.** (2026-11-02, owner)

**Why.** Reading here and commenting on github.com would mean finding the same line twice.

> **Checked 2026-11-02:** GraphQL has `addPullRequestReview`, `addPullRequestReviewThread` (takes
> `pullRequestReviewId`: "Adds a new thread to a pending Pull Request Review"), `addPullRequestReviewThreadReply`,
> `submitPullRequestReview` ("Submits a pending pull request review"), `resolveReviewThread`,
> `deletePullRequestReview`; `PullRequestReviewState.PENDING` exists. That leaving out `event` creates a pending
> review is common knowledge, not documented. `PullRequestReviewThread` carries `path`, `line`, `startLine`,
> `originalLine`, `diffSide`, `startDiffSide`, `isOutdated`, `isResolved`, `subjectType` (`LINE` | `FILE`); each
> comment carries `diffHunk` ([GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls)).

> **Checked 2026-11-02:** stacked pull requests expose no stack-level diff; each pull request shows "only the diff
> for its layer" ([about stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs)).

**Rejected.**

- Reading only, writing on github.com — the switch costs more than fast reading saves (agent, owner agreed).

## D2

**Code review is a full-screen view only; never a side panel or a modal.** (2026-11-02, owner)

**Why.** A diff needs the whole width, more so split into before and after.

## D3

**Two layouts of the diff, as on github.com: split (before and after side by side) and unified.** (2026-11-02,
owner)

## D4

**Hiding whitespace changes is a remembered choice, not reset for every pull request.** (2026-11-02, owner) It is
kept per device, like every other view detail
([settings-sync D7](../settings-sync/DECISIONS.md#d7)) — agent's reading, not confirmed.

**Why.** On github.com it has to be unticked again on every pull request (owner).

## D5

**The pull request's own conversation — comments on the pull request rather than on a line, and review summaries
— can be shown beside the diff, in a sidebar switched on and off by hand and remembered.** (2026-11-02, owner)

**Why.** On github.com you cannot see it while reading the code (owner).

**Rejected.**

- Showing it automatically when the window is wide enough — hides it at every narrowing, and behaves differently on
  a laptop with an external monitor (agent, owner chose the switch).

## D6

**githq computes the diff itself, from each file's content before and after, and shows each change with some lines
of context above and below that can be expanded.** (2026-11-02, agent, following from the owner's whitespace and
context requirements)

**Why.** No GitHub API returns a diff without whitespace changes, so a remembered whitespace switch ([D4](#d4)) needs
our own diff. Expanding context needs the whole file anyway, so with both versions in hand the diff costs nothing
extra.

> **Checked 2026-11-02:** no GitHub API offers a whitespace-ignoring diff. Neither `GET …/pulls/{n}/files`,
> `GET …/pulls/{n}` with `application/vnd.github.diff`, nor `GET …/compare/{basehead}` (parameters: `basehead`,
> `page`, `per_page` only) lists one ([pulls](https://docs.github.com/en/rest/pulls/pulls),
> [compare](https://docs.github.com/en/rest/commits/commits#compare-two-commits)). Verdict from absence in the docs.

> **Checked 2026-11-02:** `GET …/pulls/{n}/files` — "Responses include a maximum of 3000 files", 30 per page by
> default, 100 at most; when `patch` is omitted is not documented (third-party reports: binary files and files
> over roughly 3,000 changed lines). The whole diff as `application/vnd.github.diff` has no documented size limit; a
> third-party report says it fails with 406 past 20,000 lines. Compare returns "up to 300 changed files"
> ([pulls/files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)).

> **Checked 2026-11-02:** GraphQL `PullRequestChangedFile` has `path`, `additions`, `deletions`, `changeType`,
> `viewerViewedState` and no diff text; `markFileAsViewed` / `unmarkFileAsViewed` exist
> ([GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls)). File contents: GraphQL `Blob` has `text`
> ("null if the Blob is binary"), `byteSize`, `isBinary`, `isTruncated`, with no documented truncation threshold
> ([GraphQL git](https://docs.github.com/en/graphql/reference/git)). The REST contents API serves files up to 100 MB
> (raw media type above 1 MB). `api.github.com` and `raw.githubusercontent.com` both answered
> `access-control-allow-origin: *` to a live request with an `Origin` header (the latter undocumented, tried on a
> public file only).

**Rejected.**

- GitHub's ready-made patches — no whitespace-free variant, no context beyond the hunk, and silently missing for
  large files.

## Q3

**Open: which diffs start collapsed, and how a very large one is shown.** Owner: very large diffs will "probably"
be collapsed by default, "or we think about how to show them better".

## Q4

**Open: how a jump lands exactly on its target (a comment, a file, a line, the remembered reading place).** Owner's
idea: estimate the position, jump, see how far off it is, correct the estimate, repeat. Agent's proposal: anchor the
view on the target and render it first, absorbing height changes above the viewport so the target does not move;
estimates then only drive the scrollbar. The remembered reading place is the same anchor (a file and line, or a
comment) plus its offset from the top of the screen, so it survives switching layout, whitespace and expanded
context.
