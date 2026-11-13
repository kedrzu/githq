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

Near the end of the diff, where nothing is left below to scroll to, the target lands as far up as the list reaches: it
must be in view, not at the top, so no room is kept under the last file. (2026-11-06, owner)

**Rejected.**

- Room under the last file, about a screen of it, so that even a short last file could land at the very top — scrolling
  to the end showed a screen of nothing. (owner, 2026-11-06)
- Estimate, jump, measure the miss, correct and repeat (owner's first idea) — every correction is a visible jump, and
  an image loading after the last correction moves the target again.
- Remembering the scroll position in pixels — breaks at the first change of layout or whitespace.

## D8

**Generated files start collapsed — those marked `linguist-generated` in the repository's `.gitattributes`, and
known lock files by name — and so do very large files. A collapsed file is neither fetched nor diffed until
opened.** (2026-11-02, owner: "nobody reads lock files", collapsing is needed "not only for performance"; the
threshold for size is not set) Only the `.gitattributes` at the repository's root is read, at the pull request's
head; nested ones may come later (agent, after the rightsize pass). Past 16 KB of rules for this attribute, or once
matching them has cost 100 million steps, what is left stays open rather than freeze the tab, with a warning in the log
and nothing in the UI (agent, 2026-11-03).

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
  behaviour; the next file arriving is not a disturbing jump. This is about the filter being on: with it off, a viewed
  file stays in the diff collapsed to its header ([D13](#d13)).

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

`{a,b}` expands as in VS Code, and commas outside it separate patterns. `[…]` stays literal, unlike VS Code, so `[id].vue`
finds route files of Nuxt and Next. (2026-11-03, owner, on the agent's recommendation)

**Why.** A familiar pattern; regular expressions are optional because not everyone is fluent in them (owner).

**Rejected.**

- Separate filters by extension and a plain path search (agent) — one pattern covers both.

## D12

**Every thread is shown with the code it belongs to, outdated ones included. An outdated thread is placed by looking
for the commented line — the last line of its `diffHunk` — in the current file: found exactly once, the thread sits
there; otherwise at the top of its file, showing the code it was written on. Either way it is marked outdated. A
thread on a file created and deleted again within the pull request, so that the diff shows nothing, gets an entry of its
own in the file list and the diff, holding only its threads. Once such a thread is resolved, the entry is gone. A file
simply deleted in the pull request is an ordinary file, its whole diff in red as on GitHub, its threads on their lines.** (2026-11-02, owner: "it's a big problem of mine, a thread interests
me or is unresolved, but it's outdated, so I simply don't see it"; placement by search agreed after the rightsize
pass; a file simply deleted, owner, 2026-11-04) A thread on the deleted side is searched for in the file as it was before. (agent, 2026-11-03)

**Why.** File comments belong with the files, consistently, rather than in the pull request's own conversation
(owner). An approximate place is enough (owner), and the search needs nothing beyond what GitHub sends with the
comment. It misses on lines that repeat in a file (`}`, `return null`), which then go to the top of the file.

> **Checked 2026-11-02:** `PullRequestReviewComment` has `originalCommit`, `originalLine`, `originalStartLine`,
> `commit`, `line`, `outdated`, `diffHunk` (`packages/github/src/schema.graphql`, type `PullRequestReviewComment`).

**Rejected.**

- Fetching the file at the comment's original commit, diffing it against head and following the line
  ([history](history/DECISIONS.md#d12)) — one more fetch per original version for a precision the owner did not ask for.
- Outdated threads only in the pull request's conversation sidebar (agent) — file comments stay with files (owner).
- Hiding outdated threads, as github.com mostly does — exactly the owner's complaint.

## D13

**A thread on a line that is not on screen is shown with one to three lines of code around it, separated from the
rest by a mark saying how far away it is, without expanding what lies between. In an open file — hidden context, a
hidden whitespace change — that is the current code. A collapsed file shows its threads under its header with the
code they were written on (the comment's `diffHunk`), so the file stays unfetched ([D8](#d8)); expanded, it shows the
current code, and collapses back. "Show comments in collapsed files" is a view option, on by default, kept in local
preferences.** (2026-11-02, owner; the `diffHunk` for collapsed files agreed after the rightsize pass)

**Why.** Expanding a whole file or its context only to show one comment defeats the collapsing. On github.com a
collapsed file — generated, viewed or collapsed by hand — hides its comments, and once expanded a generated file
stays expanded (owner). Accepted: in a collapsed file the code beside an outdated thread is old.

**Rejected.**

- Current code around threads in collapsed files ([history](history/DECISIONS.md#d13)) — means fetching and diffing
  the file [D8](#d8) keeps unfetched.
- Expanding the context or the file up to the comment — renders everything in between for one comment.
- A comment above the code with an arrow pointing to its line, without the line (owner's first thought) — a few lines
  of code tell more.

## D14

**What you did in a pull request is kept for that pull request, in the local cache: which files were expanded or
collapsed by hand, the filters, expanded context and the reading position ([D7](#d7)). Layout ([D3](#d3)),
whitespace ([D4](#d4)), the sidebars ([D5](#d5)) and "show comments in collapsed files" ([D13](#d13)) are global
preferences, also local.** (2026-11-02, owner: "I was halfway through a pull request, switch away and lose all of
it")

Expanded context of a file is dropped when the author changes that file, since its line ranges no longer
mean the same lines (agent).

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

**In review, `J` / `K` go through the pull requests of its stack, and past either end on along the list the review was
reached from, one step per entry as in [stacked-prs D26](../stacked-prs/DECISIONS.md#d26). `[` / `]` move between files. The stack's map sits at the top of the review, one click per pull request,
and the command palette goes to any of them. Review is a full-screen route of its own, so Back returns; one key
opens it from an opened pull request; `x` and `{` / `}` select files in the list ([D10](#d10)); another pair of keys
jumps between threads; a pull request opened for the first time lands on its first file not yet viewed, otherwise on
the remembered position ([D14](#d14)).** (2026-11-02, owner: `J` / `K` and `[` / `]` for consistency with the pull
request view; the rest the agent's proposal, confirmed after the rightsize pass; through the stack, owner, 2026-11-04)

**Why.** Walking pull requests with `J` / `K` already exists and crosses from one stack into the next
([stacked-prs D9](../stacked-prs/DECISIONS.md#d9)); review keeps the same meaning, so the end of a stack is not a
special case.

**Rejected.**

- `J` / `K` taking a collapsed stack as one step, as in an opened pull request ([history](history/DECISIONS.md#d16)) — going
  through a stack in a row is what a review is for, and one step per stack would leave only the clicks for it (owner).
- `J` / `K` for files and `[` / `]` for pull requests in review (agent) — the same key would mean different things
  in the pull request view and in its review (owner).
- `Shift+J` / `Shift+K` extending the file selection — they belong with `J` / `K`, which here walk pull requests.

## D17

**A comment goes either straight to the pull request as a single comment, or into a draft review — GitHub's
pending review — submitted later as one review. A setting chooses which one `Cmd+Enter` does when no draft is open;
`Cmd+Shift+Enter` does the other. While a draft is open on the pull request, a comment can only join it, and the second
key submits the draft ([D22](#d22)).** (2026-11-02, owner: "some prefer to write a draft review and then throw it all
as one review, others prefer single comments; GitHub imposes one way") The setting is saved with the synced
settings, so every device behaves the same ([D34](#d34); owner, 2026-11-02, reversing the agent's first reading that
it was local).

**Why.** Both habits exist and GitHub's screen pushes into a draft as soon as one is started (owner). A pending
review lives on GitHub, so a draft survives closing githq and is visible on github.com; each pull request of a
stack has its own. While it is open, GitHub takes no other comment on a line from the same user on that pull request (owner's
experience: "not even an agent can do it through the API").

> **Checked 2026-11-04, live on kedrzu/githq-stack-sandbox#8:** with a draft open, a comment on a line through REST
> (`POST …/pulls/{n}/comments`) and a review with an event are refused ("can only have one pending review per pull request"),
> and through GraphQL a thread or a reply silently joins the draft: that is the owner's experience of agents. A comment on
> the pull request itself and resolving a thread go through at once. With no draft, `addPullRequestReview` with `event:
> COMMENT` and `threads` posts a single comment in one request, and a reply goes out at once;
> `addPullRequestReviewThread` always makes or joins a pending review. A submitted review can't be deleted.

So a reply can't be refused the way a comment is: one meant to go out at once first reads the draft again and doesn't go if
one is there, and what GitHub answers (`pullRequestReview.state`) says what happened in the moment between. A reply joining a
draft names it, for a draft gone by then to refuse it rather than publish it, and one starting a draft is two requests, an empty
`addPullRequestReview` and the reply, the empty draft deleted again if the reply is refused. (agent, 2026-11-04; both checked live that day: the empty review is PENDING, and a gone draft's id answers NOT_FOUND with nothing published)

**Rejected.**

- `Cmd+Shift+Enter` always posting a single comment ([history](history/DECISIONS.md#d17)) — impossible while a
  draft is open.

## D18

**Writing a suggested change is supported — it is plain markdown, a ` ```suggestion ` block in the comment,
prefilled with the selected lines. Applying someone's suggestion stays on github.com.** (2026-11-02, agent, on the
owner's condition: suggestions only if GitHub's API supports them)

**Why.** Writing one needs nothing from the API. Applying one has no API: githq would have to build the new file and
commit it to the branch itself.

> **Checked 2026-11-02:** the schema has no mutation for suggestions (no match for "suggest" apart from deprecated
> topic suggestions); `createCommitOnBranch` exists (`packages/github/src/schema.graphql`).

In the field it is the markdown itself, fences included, as github.com writes it: no tinted block, which would take a second editor over the text area. (owner, 2026-11-04; CR73 redrawn)

**Rejected.**

- Applying suggestions through `createCommitOnBranch` — no API for it, so githq would reimplement GitHub's apply
  (owner: skip what the API does not offer).

## D19

**File contents are fetched when a pull request's review is opened, not ahead of time, and kept in IndexedDB by their
blob SHA, which never changes. How that store is cleaned up is for later. Fetching ahead for pull requests waiting on
your review is an option for later.** (2026-11-02, owner; keeping by SHA agent's proposal, on disk owner's choice)

Beside the contents, the same database per login keeps what they are found by: each pull request's file list, the
blob ids of `<commit>:<path>` and the merge bases. It is deleted on sign-out. When GitHub answers `NOT_FOUND` for a pull
request, which is also its answer to someone who lost access, its kept list goes and its code stops showing; the contents
stay on disk until sign-out, since a blob may belong to other pull requests. `FORBIDDEN` and a failure to reach GitHub
keep what is shown. (2026-11-03, owner, after a real pull request of 238 files took 2.9 s to reopen with contents alone)

**Why.** A pull request read once reopens at once, also after a restart (owner chose this over memory only). Issues kept
in the local copy go on `NOT_FOUND` by the same rule. Accepted: the store grows until a clean-up exists.

> **Checked 2026-11-03:** `Blob.text` truncates near 512 KB (`deps/openssl/openssl/CHANGES.md` in nodejs/node: 928,861 bytes,
> 511,676 characters, `isTruncated`), so larger blobs come from REST `git/blobs`. A query of many `object(...)` costs 1
> point. GraphQL has no merge base; `compare/{base}...{head}?per_page=1&page=2` returns it without the files, a fork's head
> included (kedrzu/githq#80, microsoft/vscode#345559).

**Rejected.**

- Keeping contents in memory for the session only (rightsize pass) — a large pull request would be fetched again
  after every restart (owner).

## D20

**What runs where is decided by measurement, and speed is the only criterion — not effort or complexity. Files are
fetched by the app's GitHub client like everything else. Whether the diff, syntax highlighting and thread placement
run in a Web Worker, which hands the main thread the rows about to be drawn and the row counts the scroll needs
([D7](#d7)), is decided by measuring it against the main thread on a large pull request: time to the first drawn rows
and dropped frames while scrolling. WebAssembly only where the JavaScript is shown to be the bottleneck. The list is
virtualized per line, not per file.** (2026-11-02, owner: "we optimise for speed"; the worker candidate is the
agent's)

The diff runs on the main thread (2026-11-03, owner). Lines absent from the other side are dropped before it, which keeps
it minimal. Syntax colours run in a Web Worker, with highlight.js, by the measurement below; their tokens cross as
transferred arrays and only colour what is already drawn, so no height changes (2026-11-03, measured, the owner's rule).

**Why.** github.com stutters on large pull requests (owner). Copying a file's text to a worker is cheap next to
diffing and highlighting it; one GitHub client keeps the token, rate-limit handling and caching in one place.

> **Checked 2026-11-03:** kedrzu/githq#80, 250 files, production-like build, headless Chromium: list 0.6 s, first code 3.1 s
> cold and 0.03 s reopened, diffs 43 ms in all and at most 13 ms a file, scrolling p95 18.8 ms. Worst cases under bun: 25,000
> rewritten lines 3.3 s, 7 ms with the lines dropped; the same lines reordered still 2.5 s, which only a worker would help.
> Generated files of that shape collapse ([D8](#d8)).

> **Checked 2026-11-03:** tokenizing 977 KB of TypeScript in Chromium, warm: highlight.js 75 ms, Lezer 104 ms, Shiki's
> JavaScript engine 871 ms (and 13.9 s on one 143 KB Go file). Gzipped core and TypeScript grammar: highlight.js 11 KB,
> Lezer 48 KB, Shiki 71 KB. kedrzu/githq#102, 95 files, at 4× CPU slowdown: no colours 4–7 frames over 25 ms in 400,
> main thread 22–37, worker 2–9; the longest frame 34–52 ms, 118–144 ms and 33–40 ms. Time to the first row does not change.
> Posting a 1 MB file's tokens back as a transferred array takes under 0.2 ms.

**Rejected.**

- The worker fetching files itself so the text never crosses threads ([history](history/DECISIONS.md#d20)) — saves
  an unmeasured copy and splits GitHub access in two.

## D21

**An open draft review is impossible to miss. The review screen says so prominently while one is open on the pull
request — how many comments wait and the actions to submit or discard it. Lists mark a pull request that has your
open draft. The sidebar of the app gains an entry listing the pull requests with your open drafts, shown only while
there is at least one.** (2026-11-02, owner) **A separate light query looks for drafts on the open pull requests of
tracked repositories and projects, every 5 minutes and when the window regains focus.** (2026-11-04, owner)

**Why.** The owner reviews agents' pull requests. A draft started without noticing keeps the comments unsent: the
agent does not see them, and cannot post its own replies or comments while the draft stays open (owner).

> **Checked 2026-11-02:** `PullRequest.reviews` filters by `states` (including `PENDING`) and `author`
> (`packages/github/src/schema.graphql`); a pending review is visible only to its author, so for the viewer it is
> exactly "my drafts". The volatile part of a pull request is already re-read by its own query,
> `PullRequestStatuses` with `PullRequestStatusFields` (`packages/github/src/operations/`), which is where the count
> would ride. Drafts on pull requests outside githq's copy are not found at all.

> **Checked 2026-11-04, live on kedrzu/githq-stack-sandbox#8:** a pending review moves neither `updatedAt`, nor REST's
> `updated_at`, nor the issue's ETag, so nothing that watches for a change notices one: only reading the review itself
> does. `reviews(states: [PENDING])` gives its `createdAt` and `comments.totalCount`, and `reviewThreads` returns its
> threads, their comments with `state: PENDING`.

> **Measured 2026-11-04, on kedrzu/githq:** `PullRequestPendingReviews` costs 1 point (`rateLimit { cost }`) for its 6
> open pull requests, and also for 50 and 100 of its pull requests (`nodeCount` 200, about 3 KB), where
> `PullRequestStatusFields` costs 3 and about 139 KB: at most 12 points an hour per 100 open pull requests, against
> the 5,000 an hour allowed.

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

## D24

**The review is a page of its own: the app sidebar as a rail, the review's toolbar, then three columns — on the left
the stack and the file list (300 px), the diff, the conversation (340 px, right) — and the status bar. A file is a
block with its header pinned while it is in view; threads sit under their line on the side they belong to, in split
as in unified.** (2026-11-02, agent, screens CR1–CR6)

**Why.** The same shell as an opened pull request on a full page, so nothing moves when D opens the review; the
status bar already says how fresh things are and serves for loading and the API allowance (CR60, CR68).

**Amended (2026-11-05, owner).** The left column is 300 px by default and resizable: its right edge is dragged, or moved
with ←/→, from 200 to 480 px, the width kept on this device. It is the same split as a repository's left column
(`ColumnSplit`): the diff keeps at least 400 px, the column giving way down to its minimum on a narrow window.

**Amended (2026-11-13, owner).** A thread or a comment box among the diff's lines is at most 760 px wide in every
layout: at the left of its half in split, indented to the code in unified, from the file's left edge under a collapsed
or gone file's header. On a wide screen the text otherwise runs in lines too long to read.

## D25

**The stack sits at the top of the left column, above the file list: a head with its name and "2 of 4", then one row
per pull request, first to last, each a click, the open one highlighted, a row with your draft carrying an amber dot.
Once the list scrolls, the rows scroll away and a 32 px bar stays pinned in their place, with the stack's name and
one square per pull request, as the pull request's stack bar in a panel ([stacked-prs D25](../stacked-prs/DECISIONS.md#d25));
the file list's head (filter, viewed toggle) stays pinned right under it. A pull request outside a stack has no stack
section.** (2026-11-02, owner's pick of the agent's third variant, with the pinned bar added by the owner; CR47, CR48)

**Why.** The rows say what each pull request is, the bar keeps one click per pull request once you are reading, and
nothing takes height from the diff.

**Rejected.**

- The Stack bar across the top of the review, above both columns (agent's first recommendation, CR40).
- The squares in the review's toolbar (CR41) — the stack loses its name and the toolbar crowds on a laptop.

## D26

**The file list hides like the conversation: ⌘B for the file list and ⌥⌘B for the conversation, as VS Code's two side
bars, both remembered (D14), both also in the View options.** (2026-11-02, agent, settles the brief's assumption; CR6)

## D27

**The file list is GitHub's tree order: folders are quiet labels, and a file sits indented under its folder (compact
folders, as VS Code); files at the root are not indented. While a filter is on, only the matching files show, each
followed by its folder. A row has no checkbox: change letter (M, A, D, R), name, a tag for collapsed files ("lock
file", "generated", "binary"), open threads in amber, or their count in grey when all are resolved, size, and at the right end a status icon only when there is one
(loading, failed, waiting for the API allowance, gone). A viewed file has a small eye right after its name, the name
slightly dimmed. Files are ticked on their header (Viewed V) or with V.** (2026-11-02, owner: checkboxes in the list
read like the folder icons; the grey count, owner, 2026-11-04: a past discussion stays findable; CR46)

**Rejected.**

- A checkbox per row, ticked when viewed (agent's first proposal, CR43) — an empty box next to a folder icon looks
  like one more icon, and both read alike (owner).
- Colour only, or the box only (CR44, CR45) — dropped with the box.

## D28

**A pending review shows four ways, all amber. On the review, one 44 px toolbar pinned to the foot of the diff column,
under the code: the count in bold, "3 pending comments", then "Others can't see them until you submit.", Discard review… and
Submit review… (⇧S); there is no close button. The stack row of that pull request (and its square in the pinned bar) carries
an amber dot. In lists, the row's second line says "Your draft review · 3 comments unsent" in place of its other state. A collapsed stack's entry carries it too, with a dot on its place (owner, 2026-11-04).
In the app sidebar, "Draft reviews" with a count at the very top, above My work, only while there is at least one,
opening a list of them (an amber pencil with a badge on the rail). A refused submission turns the same toolbar
red.** (2026-11-03, owner: a toolbar at the foot of the diff, one row; the wording states what is, without a negation
in the title, and doesn't single out one person; CR35, CR36; lists and sidebar CR33, CR34)

**Neither way out is one click.** Discard review… opens a dialog in the middle of the screen naming the comments that go and
that they can't be brought back; focus starts on Cancel, and only the red button or ⌘↵ deletes (owner, CR39). Submit review…
opens the submit dialog of [D33](#d33).

**Why.** The diff column is wide enough for all of it in one row, and the toolbar exists only while a review is
pending. Above My work because it is the one thing in the sidebar that blocks someone else.

**Rejected.**

- A strip across the review under the toolbar (CR30) — takes height from the code (owner).
- The review's toolbar tinted amber (CR31) — ugly, and the toolbar's buttons look wrong on it (owner).
- A bar floating over the diff (CR32) — covers the screen (owner).
- A block or a toolbar in the file list's column, at its foot or top (first CR35–CR38) — too narrow for one row; the
  owner meant the diff column.
- "Your draft review isn't sent" and "claude[bot] can't see them or reply" as the wording (owner).

## D29

**Code shown out of place has its own mark: a row with a vertical arrow, how far ("172 lines further down"), why
("shown for its thread; nothing between is expanded"), a rule, and "Expand to here". It differs from the gap between
hunks, which is a filled row with expand arrows in the gutter ([D42](#d42)). In a collapsed file, the code above a thread sits in a
small box labelled "as it was when commented", because it is the comment's `diffHunk`, not the file.** (2026-11-02,
agent, CR11–CR13)

## D30

**An outdated thread carries an amber "Outdated" head that says how it was placed: "placed by finding its line
again, so the place is approximate", or, when the line is gone, the thread moves into a box of its own above the
file's first change, with the old code and the commit it was written on, closed off before the diff begins. A file
gone from the diff is a block with a file-x icon, a struck-through name and that it's no longer in the diff, holding
only its threads; its row in the list says "not in the diff".** (2026-11-04, owner; CR2, CR10, CR14)

**Rejected.**

- Naming the commits that added and deleted it — about 150 lines and one more query for a sentence
  ([history](history/DECISIONS.md#d30)).

**Amended (2026-11-13, owner).** The box of a thread whose line is gone sits, like any thread, on the half of the side
it was written on in split (the old side's for a deleted file) and indented to the code in unified, its border still
closing it off across the file. It used to take the file's whole width.

## D31

**The view options live behind one button in the review's toolbar that names what's on ("Split · whitespace
hidden"); it opens a menu with the layout, whitespace, comments in collapsed files and the two columns, and the note
that they are kept for every pull request on this device. The two column toggles also sit beside it.** (2026-11-02,
agent, CR50)

**Why.** Set rarely, but which layout and whether whitespace is hidden must be visible, or a hidden change looks
like no change.

## D32

**Keys of the review: D opens it from an opened pull request (the merge section's "Review files" moves from ⇧O,
which opened github.com, to D); `[` `]` files, N ⇧N threads, V viewed, x `{` `}` select, Space collapses a file, /
filters, C comments on the line under the cursor, R replies to the focused thread, ⌘G inserts a suggestion, ⇧S
submits, ? lists them all.** (2026-11-02, agent, CR1, CR29; owner confirmed 2026-11-03)

There is no line cursor: ↓ ↑ scroll the diff by a line, and C takes the current file's line at the reading line
(D44), so C, V and Space always act on the same file; E opens the hidden lines nearest it (D42). (owner,
2026-11-10; CR29)

A range has three ways, all ending in the same selection (CR73, CR83): press a line number and drag along the numbers, as on github.com; ⇧click a second number; or ⇧↓. It stays on one side of the diff and stops at a gap. (owner, 2026-11-04: drag stays though no frame drew it, and the design follows)

⇧↓ is CR73's: from the diff it takes the next line into the last box written in; in a box only while the box is empty, for with text in it it is the text's own selection. ⇧S on the list of draft reviews opens the selected one's review at its submit dialog (CR34). (agent, 2026-11-04)

**Why.** D and ⇧S are unused in item views; N ⇧N already mean next and previous match in a workflow log.

## D33

**The comment box's two buttons carry their label and key, and that is all it says: Comment ⌘↵ / Start a review ⌘⇧↵, or
Start a review ⌘↵ / Comment now ⌘⇧↵. With a draft open: Add to draft ⌘↵ / Submit draft (4 comments) ⌘⇧↵. Submitting opens a dialog in the middle of the screen: an
optional comment, which goes on the pull request itself rather than on a file, then Comment (the default), Approve or
Request changes on 1 2 3, the pending comments listed — and a refused submission turns the pending toolbar red with
GitHub's reason and keeps everything.** (2026-11-02, agent, CR70–CR76; the dialog's optional comment and place, owner, 2026-11-03)

> **Checked 2026-11-03:** `SubmitPullRequestReviewInput` has `body: String`, the review's own text (`packages/github/src/schema.graphql`). Not tried live.

⇧S and the dialog work with no draft too, an approval or a word with no line comment before it: `addPullRequestReview` with the event, the body and the head read, no threads. (agent, 2026-11-04)

> **Checked live 2026-11-04:** with neither body nor threads COMMENT is refused with type UNPROCESSABLE and an empty message, so the app says so in its own words. Approving and requesting changes on your own pull request are refused with GitHub's words ("Review Can not approve your own pull request", "Review Can not request changes on your own pull request"). With no comments, Comment and Request changes need text before they can be sent; GitHub's docs also require a body for those two.

**A box through a push.** A box remembers the commit it was written against. When the head moves it stays on its line number, with its text and keys, and says the code changed, so a comment can't land on different code unnoticed (CR87). Sending posts to that line on the new head: a draft can't name an older commit. (owner, 2026-11-04)

**How a finish that failed behaves.** (agent, 2026-11-04) D28's "no close button" stays true for CR76: while the draft a review was sent against is open, the red toolbar has Edit review… and Try again. Refused with no draft open now, it also has Dismiss, which keeps the dialog's choice. With a different draft open it has GitHub's reason, Dismiss and Edit review…, and no Try again, because only the dialog, which lists that draft's comments, may submit a draft the reader hasn't seen. With no draft, a send shows the amber toolbar saying "Sending your review…", with no count, note or buttons. The sending row and the Dismiss states have no frame in the mockups.

A failure clears on a read finding no draft only if it was a discard, or the second key's review, whose comment went with the draft, or got no answer while it had a draft: that one almost certainly got there, so the dialog's choice empties too. A review from the dialog refused against a draft since gone stays red, and Try again sends it with no draft, carrying no hidden comments. A draft of the reader's own making clears a failure sent against another; one arriving by a read doesn't, so the refusal is still seen. A submit made while comments were on their way sends nothing if one of them is refused: it says so, and Try again sends it knowingly without that comment.

> **Checked live 2026-11-04:** `submitPullRequestReview` on a review already submitted is refused with type UNPROCESSABLE, "Could not comment pull request review."; nothing is posted.

**Why.** The buttons say what each key does. A line explaining the default broke the layout and repeats what someone who
chose that setting already knows (owner, 2026-11-03).

**Rejected.**

- A line in the box saying what ⌘↵ will do and where it is set (agent) — reminds you of your own choice every time (owner).

## D34

**The comment setting sits in Settings, in a section of its own, Code review: Send it at once / Add it to a draft
review. It is saved with the synced settings.** (2026-11-03, owner: "synchronised", and a section of its own once
Settings became a column of sections; CR77, now in App · Settings)

## D35

**Loading and failure, in place: a file whose content hasn't arrived is its header and quiet bars, and its row's box
is a spinner; files that may be generated show only their header until `.gitattributes` is read, so nothing flips
open to collapsed; a jump to an unfetched file fetches it first and holds its header in place; a push since the last
visit shows one quiet accent line naming the files that lost their viewed mark, each also tagged in the list; 3,000
listed files out of more say "3,000+" and pin a note at the foot of the list, using `PullRequest.changedFiles` for the
total; a failed file says GitHub's answer with Try again and Open on GitHub; the API allowance running out pauses the
missing files with the time they'll come, while edits still go through.** (2026-11-02, agent, CR60–CR68)

> **Checked 2026-11-02:** `PullRequest.changedFiles: Int!` exists (`packages/github/src/schema.graphql`).

Open: the size past which a file is "too large to diff here" (CR67 says 1 MB) is a placeholder; D8 left the threshold
unset. GitHub's wording in the failure screens (CR67, CR76) is a placeholder for its real messages.

## D36

**Code in a diff shows without ligatures: `=>` and `===` are the characters in the file.** (2026-11-03, owner, on the
agent's recommendation)

**Why.** A review reads what is in the file; the mockups' JetBrains Mono ligatures draw something that isn't.

## D37

**Syntax colours are a muted palette of five: lavender keywords, sage strings, amber numbers and constants, blue functions
and types, dimmed comments; the rest is the line's text colour.** (2026-11-03, owner, on the agent's proposal, seen on real
code; the mockups draw code monochrome)

**Why.** Calm, few colours (AGENTS.md); each is AA over the window and over a deleted or an added line.

## D38

**A file still on its way is drawn as lines of code it might hold: one quiet bar per line, where its code will start,
in the layout being read; split mirrors context on both sides and keeps added lines right, deleted left; the lengths are
drawn from the file's path, so they read like text and never reshuffle.** (2026-11-05, owner asked for it, agent's
design; CR88, CR89; refines D35's "quiet bars")

How the bars are drawn: a PRNG seeded with a hash of the path (e.g. FNV-1a into mulberry32). Per line: a blank one with
probability 0.1, never two in a row, after which the indent drops to at most 1; otherwise the indent steps −1/0/+1 with
probabilities 0.2/0.6/0.2 within 0–4 levels of two characters, and the length is normal around 26 characters with σ 12,
clamped to 3–72. A modified file comes as runs of 2–6 context lines, each followed by 0–4 deleted and 0–4 added lines
(at least one). Split puts a context line on both sides and pairs deleted with added, leaving the shorter run's rows
empty on its side; unified lists context, then deleted, then added. As many rows as the file's added plus deleted lines
(D35's height, unchanged). Bars are 8 px tall on the 20 px line, `$bg-3`, radius 2, clipped at the column's edge.

**Why.** Six fixed lengths repeating read as a pattern, not as code, and a single column under a split view announces a
different layout from the one that arrives. Seeding by path keeps a file's bars the same when it scrolls out and back,
and across layouts. No colour and no shimmer: the calm UI, and the status bar already says what's loading.

## D39

**The comment box is the shared editor (`Activity / Editor`), inset under its line on its own side, where its thread
will sit, in split as in unified: a head saying where it goes ("Comment on line 50", "Comment on lines 48–51",
"Reply to sofiab and mlaine"), Suggest a change as the first button of the format toolbar (⌘G, as on github.com),
then the text, and a footer with Cancel Esc beside D33's two send buttons. The amber "code changed" line (D33) and a
red "Not sent: {reason}." line sit between the head and the editor, the text kept. A reply is the same box inside the
thread.** (2026-11-10, owner's pick of the agent's first variant; the Markdown hint dropped, Suggest moved into the
toolbar and the primary button's key drawn in the accent's colours, owner; CR90–CR93, also CR70–CR74, CR83, CR87)

**Why.** It is the thread it becomes, so sending moves nothing around it, and it is the same editor as the
conversation's, which the old box was not.

**Rejected.**

- A card across both sides of a split diff under the row (CR94) — covers the other side, and the thread jumps to its
  half once sent.
- A box docked at the foot of the diff column (CR95) — away from its line, and only one box at a time.

## D40

**Esc on an empty box closes it. On a box with text, Esc asks in place: the footer becomes "Discard what you wrote?"
with Keep writing (Esc) and Discard (↵), no dialog. After Discard a toast offers Restore ⌘Z for ten seconds, which
reopens the box under its line with its text.** (2026-11-10, owner: the agent's second and third variants together;
CR97, CR98)

Focus stays in the field while it asks, so ↵ there means Discard, not a new line, and typing anything takes the
question away and goes back to writing. Restore ⌘Z works only while no text field has focus, since in a field ⌘Z is
the field's own undo. The toast's Dismiss has no key, because Esc leaves the review; with a draft open the toast sits
above the pending review's toolbar (CR35), never over it. (owner, 2026-11-10)

**Rejected.**

- Esc closing without a question and leaving an "Unsent comment" row under the line (CR96, agent's first
  recommendation).

## D41

**A file's block ends with its own 1 px border and rounded corners, and the next file starts 8 px below; the 4 px
closing strip and its 12 px margin go. With a header pinned (D24), the next header pushes it up and the 8 px of
background shows between them for a moment.** (2026-11-10, owner's pick of the agent's first variant; CR99)

**Rejected.**

- No gap, every file in one bordered column (CR100) — the end of one file and the start of the next told apart only by
  the header.
- A gap only before an expanded file (CR101) — the gap appears and disappears as files are ticked viewed.

## D42

**Hidden lines open from arrows in the number gutter, as on github.com: ↓ shows 20 lines below the hunk above, ↑ 20
above the hunk below, and a gap of 20 or fewer has one ↕ for all of it. A click elsewhere on the row shows 20 toward
the nearest hunk, the one on the reading line's side (D44): the hunk above for a gap below the reading line, the hunk
below for one above it; a gap of 20 or fewer opens whole. The row carries the enclosing declaration only when it is a
real one (a class, function or method signature), never a comment opener or a brace, and no hunk header: our hunks
are not git's (D6), so its numbers would not match github.com's. The gap at the top of a file has only ↑, the one at
its end only ↓. From the keyboard, E expands the gap nearest the reading line, 20 toward its hunk each time it is pressed, and
"Show all hidden lines" in the command menu opens all of it; ⇧E stays Re-run failed checks, a pull request's key
that the review keeps. Hover lights the arrow under the pointer, or on the rest of the row the arrow a click takes; Tab focus outlines it
in accent. A push that changes the file resets what was expanded in it (D14), and its gaps say so once (CR62).**
(2026-11-10, owner's pick of the agent's second variant; row click, E and no hunk header by the owner the same
day; CR103; replaces D29's "Show 20 · Show all")

The arrows sit side by side in the 48 px gutter, 24 × 24 each, so the row is 26 px: two stacked 18 px arrows fail
WCAG 2.5.8's 24 px target size, which the story tests hold, and stacking two 24 px ones made the row 50 px. With
the arrows on its keyboard focus, the count reads what ↵ does ("↵ shows 20 below line 47"). A gap whose lines are all
shown for threads (nothing hidden) but whose expanded context a push reset says only "Context you expanded here was
reset by the push", with no count and no arrow (`Diff / Gap · reset, nothing hidden`). "A real one" means a
declaration: a class, interface, type, function or method signature, including one broken over several lines whose
first line opens its parameters (`async load(`); of calls only a test's `describe`, `it` and `test`, whose names say
what the code is in, while other calls (`watch(x, () => {`, `useEffect(() => {`) and branches (`elif`, `when`) are not.
(owner, 2026-11-11, building M1)

A gap never hides a single line: the row (26 px) would be taller than the line it hides, so that line shows as context,
between hunks, at a file's ends and between expanded ranges. git's patches do hide one, so a patch placeholder (D45)
shows such a line too. The push-reset notice (CR62) goes on the file's first gap that still hides lines. (owner,
2026-11-12, building M3)

**Rejected.**

- One full-width row, a click showing 20 and ⌥click all (CR102, agent's recommendation).
- One click showing every hidden line (CR104) — a long gap floods the screen.
- The arrows stacked, 18 px each (CR103 as first drawn) — below WCAG 2.5.8's target size; 24 px stacked made the row
  50 px. (owner, 2026-11-11)

## D43

**On hover a line's number turns accent and underlined, with a small comment icon in the margin before it: click the
number to comment, drag along the numbers or ⇧click for a range (D32). No tint, and the code stays selectable as text.
The same on context, added and deleted lines, in split and unified; during a drag the range is tinted and the number
under the pointer marked.** (2026-11-10, owner's pick of the agent's second variant; CR106)

The number column is as wide as the file's longest number needs with the icon before it, so a number of four digits
or more keeps the icon inside its cell rather than over the block's edge or the other number. (owner, 2026-11-11,
building M1)

**Rejected.**

- A + button between the number and the code, with a row tint (CR105, agent's recommendation).
- A tint and a "C comment" hint at the line's end (CR107) — clicking code to select it and to comment collide.

## D44

**The current file — the one V, Space and C act on — shows in the diff: its header faintly tinted with an accent
chevron, and its block's edge in accent; pinned or in place, expanded, collapsed or viewed alike. It is the file whose
block crosses a reading line a third down under the pinned header, sliding down near the end of the diff; a click in
a file, `[` `]`, the file list or V moving on holds it until it leaves the screen or the reader scrolls a fair
distance. The reading line is never drawn. C comments on the current file's line at the reading line, or on its line
nearest to it while the file is held off the line, so C, V and Space always act on the same file (D32).**
(2026-11-10, owner's pick of the agent's first variant; C by the owner the same day; CR108)

How it behaves, settled while building M2 (owner, 2026-11-11): the reading line slides at both ends of the diff, up to
the top edge while the diff is scrolled less than the line's own depth and down to the bottom edge over the last screen,
so the first and the last files can be current too; the 8 px between two files belongs to the file below. Space, N and
⇧N, and the review's landing hold a file as a click does. V moves on to the next file whether viewed files are hidden or
shown. C takes N's thread only when that thread is in the current file. A file that leaves the diff (viewed and hidden,
or a resolved thread's file) goes when it leaves the top of the screen, not when the reading line passes it (D7). The
current header's tint is accent at 6% (`#7B87F70F`), so every text on it keeps AA (D30); its edge, opaque, is accent at
60% over the window.

**Rejected.**

- A 2 px marker in the diff's left margin (CR109).
- Every other file dimmed (CR110) — the dim flickers from file to file while scrolling.

## D45

**Heights and placeholders come from GitHub's per-file patch once it arrives. The patch is a separate, paginated request
(`GET …/pulls/{n}/files`, 100 files a page), so until a file's page is in, the file is its header and D38's grey bars,
as many as its additions and deletions: a guess (CR115). Then the patch decides:**

- **no patch, 0/0 lines and MODIFIED, ADDED or DELETED: binary, its final one-line note;**
- **RENAMED with 0/0 lines: "Renamed, no changes", its final one-line note;**
- **a patch: D38's bars in its real hunk layout, its line numbers from the hunk headers in the number columns, its gap rows in place with their counts, and since the patch says
  which lines are added and deleted, those bars take the line's tint (CR111);**
- **no patch but lines: GitHub left the diff out for its size, so the grey bars stay, sized from the additions and
  deletions, a guess.**

**"Too large to diff here" (D35, in bytes) is not in the patch: it shows once the file's blob says so, the bars turning
into the note (CR116). Even a patch's layout is close, not exact, because our diff is not git's (D6) and may differ by a
few rows; D7's anchor absorbs what differs. With whitespace hidden the bars keep the patch's layout but stay grey
(CR113): which lines stay changed is not known until the file is diffed.** (2026-11-10, owner: the tint "if we know
where the added and deleted lines are", and the agent's second variant for a guess; corrected the same day for what
the patch does not give; CR111, CR113, CR115, CR116; amends D38's count and its "no colour")

Settled while building M3 (owner, 2026-11-12): a placeholder's rows hold the reading position as the lines they
stand for (the file, the side, the line), so a file arriving under the reader, or a layout switch, moves nothing; a
file with 0/0 lines is only its header until its patch says what it is; a binary verdict's note stays when the blob
read fails or pauses; a RENAMED file with 0/0 lines says "Renamed, no changes" only once its blobs are the same on
both sides — a renamed binary whose content changed reports 0/0 too, and gets the binary note; while the patches are
read the status bar says "Reading the changes", with "· 3 of 30 pages" when there is more than one (CR115).

When GitHub omits `patch` is not documented (D6: third-party reports of binary files and very large diffs). Files past
GitHub's 3,000-file listing are not in the diff at all (D35), so they need no placeholder.

Open: MODIFIED, ADDED or DELETED with 0/0 lines and no patch is also a mode change or an empty file. Until the blob
(`isBinary`, `byteSize`) says otherwise it reads as binary; their own notes are not drawn.

**Rejected.**

- A compact band with the files after it held back until it is drawn (CR112, agent's recommendation).
- A compact band with the next files shown (CR114) — the biggest jump when it is drawn.

## D46

**The conversation is the pull request's own comment cards (`Activity / Comment`, `Activity / Review`), with their ⋯:
Edit in place, Quote reply into the conversation's composer, Copy link and Delete…, where GitHub says the viewer may; a
review's offers Quote reply and Copy link. Its column is resized by its inner edge like the file list's, from 340 px
(its least and its default) to 720 px, the width kept on the device. A card narrower than 480 px lays itself out narrow
by its own width (a container query): no gutter, the avatar starting the head, the age without the verb, a review's
threads on a line under its text.** (2026-11-13, owner: "the same comment components everywhere", the sidebar
resizable, container queries; CR120–CR126; amends D24's fixed 340 px)

**Rejected.**

- The phone's flat comment row (`Phone / Comment`) as the narrow card — it is not the same component as the pull
  request's.
- A narrow card with its avatar beside it as on the pull request's thread — about 260 px left for the text at 340 px.
