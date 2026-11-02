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

## D7

**A jump lands on its target by rendering the target first and holding it in place on screen; heights that turn out
different above the screen are absorbed into the scroll position, so what you look at does not move. "Where you
are" is a thing with its own identity — a line of a file on one side, or a comment — plus its distance from the top
of the screen.** (2026-11-02, agent's proposal, owner agreed)

**Why.** Comments have unpredictable heights (markdown, images that load late) and lines may wrap, so no estimate of
the content above a target is exact. Holding the target in place makes the estimate matter only for the scrollbar.
The same position survives switching layout ([D3](#d3)), whitespace ([D4](#d4)) and expanded context ([D6](#d6)),
and is what is remembered per pull request when moving through a stack. If the remembered line is hidden (a
whitespace-only change after hiding whitespace), the view lands on the nearest visible line above it.

**Rejected.**

- Estimate, jump, measure the miss, correct and repeat (owner's first idea) — every correction is a visible jump, and
  an image loading after the last correction moves the target again.
- Remembering the scroll position in pixels — breaks at the first change of layout or whitespace.

## D8

**Generated files start collapsed — those marked `linguist-generated` in the repository's `.gitattributes`, and
known lock files by name — and so do very large files. A collapsed file is neither fetched nor diffed until
opened.** (2026-11-02, owner: "nobody reads lock files", collapsing is needed "not only for performance"; the
threshold for size is not set)

**Why.** Some files are simply not read, and a large pull request should cost only what you open.

> **Checked 2026-11-02:** neither GraphQL `PullRequestChangedFile` (`path`, `additions`, `deletions`, `changeType`,
> `viewerViewedState`) nor REST `pulls/{n}/files` says whether a file is generated, so githq would read
> `.gitattributes` (`linguist-generated`) itself ([GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls),
> [pulls/files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)).

**Rejected.**

- Collapsing by size alone — a small lock file still is not read (owner).

## D9

**The "viewed" mark is GitHub's own, read and written through the API, so it agrees with github.com both ways. The
file list shows which files are viewed (icon or colour left to the screen design) and can be filtered as on
github.com. With viewed files filtered out, marking a file viewed removes it from the list and from the diff at
once, and the next file takes its place on screen.** (2026-11-02, owner: "exactly as on GitHub, and it's quite
nice")

**Why.** The owner marks files as seen so they stop showing up; the list shrinks as the pull request is read. The
jump is wanted here: it is the next file arriving. In terms of [D7](#d7) the position moves to the next visible file,
which starts at the top of the screen, or where the removed file started if that was lower. GitHub drops the mark
when the file changes in a later push, so a second round of review shows only what changed since.

> **Checked 2026-11-02:** `PullRequestChangedFile.viewerViewedState` and the mutations `markFileAsViewed` /
> `unmarkFileAsViewed` (`path`, `pullRequestId`) exist ([GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls)).

**Rejected.**

- Collapsing a viewed file to its header in the diff and filtering only the list (agent) — owner prefers GitHub's
  behaviour; the next file arriving is not a disturbing jump.

## D10

**Files can be selected several at a time in the file list, and an action — first of all marking them viewed —
applies to all of them: click, Shift+click for a range, Cmd/Ctrl+click to add one; from the keyboard the same keys
as githq's lists.** (2026-11-02, owner; keyboard by agent)

**Why.** Many files in a pull request are of no interest, and marking them one by one is click after click (owner).

> **Checked 2026-11-02:** githq's lists toggle a row with `x`, extend the selection with `Shift+J` / `Shift+K` and
> clear it with `Escape` (`packages/app/lists/ListView.vue:284-320`).

Marking many files viewed is many `markFileAsViewed` mutations; they go in one GraphQL request (aliases), shown at
once, as every edit in githq.

## D11

**The file list is filtered by a path pattern with wildcards, as in VS Code's file filters: `*.png` or `.png` means
the extension, `docs/**/*.png` a folder and an extension. A toggle button with an icon, as in VS Code, switches the
pattern to a regular expression. Next to it, the viewed filter of [D9](#d9).** (2026-11-02, owner)

**Why.** A familiar pattern; regular expressions are optional because not everyone is fluent in them (owner).

**Rejected.**

- Separate filters by extension and a plain path search (agent) — one pattern covers both.

## D12

**Every thread is shown with the code it belongs to, outdated ones included. An outdated thread sits where its line
is now, marked as outdated and placed approximately. A thread on a file that is no longer in the diff — deleted, or
created and deleted again within the pull request so that the diff shows nothing — gets an entry of its own in the
file list and the diff, holding only its threads. Once such a thread is resolved, the entry is gone.** (2026-11-02,
owner: "it's a big problem of mine, a thread interests me or is unresolved, but it's outdated, so I simply don't see
it")

**Why.** File comments belong with the files, consistently, rather than in the pull request's own conversation
(owner). Where the line is now can be computed rather than guessed: githq already diffs files itself ([D6](#d6)), so
it diffs the file at the comment's original commit against the current head and follows the line through; when the
line itself was rewritten, the thread goes to its nearest surviving neighbour — that is the "approximate" case.

> **Checked 2026-11-02:** `PullRequestReviewComment` has `originalCommit`, `originalLine`, `originalStartLine`,
> `commit`, `line`, `outdated`, `diffHunk` (`packages/github/src/schema.graphql`, type `PullRequestReviewComment`).

**Rejected.**

- Outdated threads only in the pull request's conversation sidebar (agent) — file comments stay with files (owner).
- Hiding outdated threads, as github.com mostly does — exactly the owner's complaint.

## D13

**A thread on a line that is not on screen — hidden context, a hidden whitespace change, a collapsed file — is shown
with one to three lines of code around it, separated from the rest by a mark saying how far away it is, without
expanding what lies between. A collapsed file shows such pieces under its header, marked as collapsed, and can be
expanded whole and collapsed back. "Show comments in collapsed files" is a view option, on by default, kept in local
preferences.** (2026-11-02, owner)

**Why.** Expanding a whole file or its context only to show one comment defeats the collapsing. On github.com a
collapsed file — generated, viewed or collapsed by hand — hides its comments, and once expanded a generated file
stays expanded (owner).

**Rejected.**

- Expanding the context or the file up to the comment — renders everything in between for one comment.
- A comment above the code with an arrow pointing to its line, without the line (owner's first thought) — a few lines
  of code tell more.

## D14

**What you did in a pull request is kept for that pull request, in the local cache: which files were expanded or
collapsed by hand, the filters, expanded context and the reading position ([D7](#d7)). Layout ([D3](#d3)),
whitespace ([D4](#d4)), the sidebars ([D5](#d5)) and "show comments in collapsed files" ([D13](#d13)) are global
preferences, also local.** (2026-11-02, owner: "I was halfway through a pull request, switch away and lose all of
it")

**Why.** Moving between the pull requests of a stack should cost nothing. Nothing of this goes to the synced
settings, which hold only what is tracked ([settings-sync D7](../settings-sync/DECISIONS.md#d7)).

## D15

**The viewed filter never hides a file that has an unresolved thread: the file stays as its header with the pieces
of code that carry threads ([D13](#d13)).** (2026-11-02, owner, on the agent's recommendation)

**Why.** A colleague's comment on a file already marked viewed does not drop the mark — only a change to the file
does — so with the filter winning, that comment would appear nowhere in the diff: the very missed thread the owner
complains about. Accepted cost: a thread deliberately left open keeps its file in the list until it is resolved.

**Rejected.**

- The filter wins and the list shrinks to nothing — a new comment on a viewed file is missed.

## D16

**In review, `J` / `K` move to the next and previous pull request exactly as they do in an opened pull request
today, and `[` / `]` move between files. The stack's map sits at the top of the review, one click per pull request,
and the command palette goes to any of them.** (2026-11-02, owner: consistency with the pull request view; the
rest agent's proposal, not yet confirmed: review is a full-screen route of its own, so Back returns; one key opens it
from an opened pull request; `x` and `{` / `}` select files in the list ([D10](#d10)); another pair of keys jumps
between threads; a pull request opened for the first time lands on its first file not yet viewed, otherwise on the
remembered position ([D14](#d14)))

**Why.** Walking pull requests with `J` / `K` already exists and crosses from one stack into the next
([stacked-prs D9](../stacked-prs/DECISIONS.md#d9)); review keeps the same meaning, so the end of a stack is not a
special case.

**Rejected.**

- `J` / `K` for files and `[` / `]` for pull requests in review (agent) — the same key would mean different things
  in the pull request view and in its review (owner).
- `Shift+J` / `Shift+K` extending the file selection — they belong with `J` / `K`, which here walk pull requests.

## D17

**A comment goes either straight to the pull request as a single comment, or into a draft review — GitHub's
pending review — submitted later as one review. A setting chooses which one `Cmd+Enter` does when no draft is open;
`Cmd+Shift+Enter` does the other. While a draft is open on the pull request, a comment can only join it, and the second
key submits the draft ([D22](#d22)).** (2026-11-02, owner: "some prefer to write a draft review and then throw it all
as one review, others prefer single comments; GitHub imposes one way") The setting is local, like every preference
so far — agent's reading, the synced settings holding only what is tracked
([settings-sync D7](../settings-sync/DECISIONS.md#d7)).

**Why.** Both habits exist and GitHub's screen pushes into a draft as soon as one is started (owner). A pending
review lives on GitHub, so a draft survives closing githq and is visible on github.com; each pull request of a
stack has its own. GitHub accepts nothing else from the same user on that pull request while it is open (owner's
experience: "not even an agent can do it through the API").

> **Checked 2026-11-02:** `AddPullRequestReviewThreadInput` takes either `pullRequestReviewId` (into a pending
> review) or `pullRequestId`, plus `path`, `line`, `side`, `startLine`, `startSide`, `subjectType`
> (`packages/github/src/schema.graphql`). A third-party guide claims REST `POST …/pulls/{n}/comments` still posts
> a standalone comment ([guide](https://www.claudepluginhub.com/skills/mthalman-superpowers/skills%2Fgithub-pr-reviews));
> the owner's experience says otherwise, and the design follows the owner. Not tried live.

**Rejected.**

- `Cmd+Shift+Enter` always posting a single comment ([history](history/DECISIONS.md#d17)) — impossible while a
  draft is open.

## D18

**Writing a suggested change is supported — it is plain markdown, a ```` ```suggestion ```` block in the comment,
prefilled with the selected lines. Applying someone's suggestion stays on github.com.** (2026-11-02, agent, on the
owner's condition: suggestions only if GitHub's API supports them)

**Why.** Writing one needs nothing from the API. Applying one has no API: githq would have to build the new file and
commit it to the branch itself.

> **Checked 2026-11-02:** the schema has no mutation for suggestions (no match for "suggest" apart from deprecated
> topic suggestions); `createCommitOnBranch` exists (`packages/github/src/schema.graphql`).

**Rejected.**

- Applying suggestions through `createCommitOnBranch` — no API for it, so githq would reimplement GitHub's apply
  (owner: skip what the API does not offer).

## D19

**File contents are fetched when a pull request's review is opened, not ahead of time, and kept by their blob SHA,
which never changes. Fetching ahead for pull requests waiting on your review is an option for later.** (2026-11-02,
owner; keeping by SHA agent's proposal)

## D20

**What runs where is decided by measurement, and speed is the only criterion — not effort or complexity.** The
candidate: a Web Worker fetches file contents itself, so the text never crosses to the main thread, computes the
diff, syntax highlighting and the placement of threads, and hands the main thread only the rows about to be drawn
plus the row counts the scroll needs ([D7](#d7)). The list is virtualized per line, not per file. It is adopted if
it beats doing the same on the main thread on a large pull request — time to the first drawn rows and dropped frames
while scrolling; WebAssembly only where the JavaScript is shown to be the bottleneck. (2026-11-02, owner: "we
optimise for speed"; the candidate is the agent's)

**Why.** github.com stutters on large pull requests (owner). Fetching inside the worker removes the cost the owner
worried about, sending texts there and back.

## D21

**An open draft review is impossible to miss. The review screen says so prominently while one is open on the pull
request — how many comments wait and the actions to submit or discard it. Lists mark a pull request that has your
open draft. The sidebar of the app gains an entry listing the pull requests with your open drafts, shown only while
there is at least one.** (2026-11-02, owner)

**Why.** The owner reviews agents' pull requests. A draft started without noticing keeps the comments unsent: the
agent does not see them, and cannot post its own replies or comments while the draft stays open (owner).

> **Checked 2026-11-02:** `PullRequest.reviews` filters by `states` (including `PENDING`) and `author`
> (`packages/github/src/schema.graphql`); a pending review is visible only to its author, so for the viewer it is
> exactly "my drafts". The volatile part of a pull request is already re-read by its own query,
> `PullRequestStatuses` with `PullRequestStatusFields` (`packages/github/src/operations/`), which is where the count
> would ride. Not checked: whether starting a draft on github.com moves anything the background refresh notices, so a
> draft begun there may show late; and drafts on pull requests outside githq's copy are not found at all.

## D22

**While a draft review is open on the pull request, the second key adds the comment and submits the whole draft at
once as a comment review; its label says so, with the count ("Submit draft (4 comments)").** (2026-11-02, owner,
on the agent's recommendation)

**Why.** The usual moment to want a comment out is when the agent on the other side needs it; this turns the trap
into the shortcut. Accepted risk: someone wanting to send one remark sends the whole draft — hence the label.

**Rejected.**

- The key unavailable while a draft is open, saying why — leaves the comments stuck, which is the owner's problem.

## D23

**Built in two steps. First reading: the diff with context, whitespace and both layouts, collapsed and viewed files,
filters and selection, every thread in place with exact jumps, the conversation sidebar, moving through a stack, the
remembered state — plus the open-draft warnings of [D21](#d21), which help even while drafts are still written on
github.com. Then writing: comments, replies, resolving, drafts and submitting.** (2026-11-02, owner, on the agent's
proposal)

**Why.** Reading already replaces most of github.com's review screen and is where the worker is measured
([D20](#d20)); draft warnings catch drafts started on github.com today.
