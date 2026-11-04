# Retired decisions

Decisions that held once, in full, under their original IDs. Never edited after they are written, apart from adding
the next retired form.

## D17

Retired 2026-11-02, replaced by the current [D17](../DECISIONS.md#d17): a single comment cannot be posted
while a draft review is open.

**A comment goes either straight to the pull request as a single comment, or into a draft review — GitHub's
pending review — submitted later as one review. A setting chooses which one `Cmd+Enter` does; `Cmd+Shift+Enter`
always does the other.** (2026-11-02, owner: "some prefer to write a draft review and then throw it all as one
review, others prefer single comments; GitHub imposes one way") The setting is local, like every preference so far —
agent's reading, the synced settings holding only what is tracked ([settings-sync D7](../settings-sync/DECISIONS.md#d7)).

**Why.** Both habits exist and GitHub's screen pushes into a draft as soon as one is started (owner). A pending
review lives on GitHub, so a draft survives closing githq and is visible on github.com; each pull request of a
stack has its own.

> **Checked 2026-11-02:** `AddPullRequestReviewThreadInput` takes either `pullRequestReviewId` (into a pending
> review) or `pullRequestId`, plus `path`, `line`, `side`, `startLine`, `startSide`, `subjectType`
> (`packages/github/src/schema.graphql`). Whether a single comment can be posted while the user has a pending review
> on the same pull request is open: [Q7](#q7).

## D12

Retired 2026-11-02, replaced by the current [D12](../DECISIONS.md#d12): outdated threads placed by searching for the commented line rather than by diffing the original file.

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

Retired 2026-11-02, replaced by the current [D13](../DECISIONS.md#d13): threads in a collapsed file show the code they were written on, so the file stays unfetched.

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

## D20

Retired 2026-11-02, replaced by the current [D20](../DECISIONS.md#d20): files are fetched by the app's GitHub client, not by the worker.

**What runs where is decided by measurement, and speed is the only criterion — not effort or complexity.** The
candidate: a Web Worker fetches file contents itself, so the text never crosses to the main thread, computes the
diff, syntax highlighting and the placement of threads, and hands the main thread only the rows about to be drawn
plus the row counts the scroll needs ([D7](#d7)). The list is virtualized per line, not per file. It is adopted if
it beats doing the same on the main thread on a large pull request — time to the first drawn rows and dropped frames
while scrolling; WebAssembly only where the JavaScript is shown to be the bottleneck. (2026-11-02, owner: "we
optimise for speed"; the candidate is the agent's)

**Why.** github.com stutters on large pull requests (owner). Fetching inside the worker removes the cost the owner
worried about, sending texts there and back.

## D30

Retired 2026-11-04, replaced by the current [D30](../DECISIONS.md#d30): a gone file says only that it's no longer in the diff, not which commits added and deleted it.

**An outdated thread carries an amber "Outdated" head that says how it was placed: "placed by finding its line
again, so the place is approximate", or, when the line is gone, the thread moves into a box of its own above the
file's first change, with the old code and the commit it was written on, closed off before the diff begins. A file
gone from the diff is a block with a file-x icon, a struck-through name and the reason ("added in 3f0c2aa, deleted
again in 9b7e411"), holding only its threads; its row in the list says "not in the diff".** (2026-11-02, agent,
CR2, CR10, CR14)

## D12, the file deleted

Retired 2026-11-04, replaced by the current [D12](../DECISIONS.md#d12): a file simply deleted keeps its diff, and only a file created and deleted again is an entry of threads alone.

**Every thread is shown with the code it belongs to, outdated ones included. An outdated thread is placed by looking
for the commented line — the last line of its `diffHunk` — in the current file: found exactly once, the thread sits
there; otherwise at the top of its file, showing the code it was written on. Either way it is marked outdated. A
thread on a file that is no longer in the diff — deleted, or created and deleted again within the pull request so
that the diff shows nothing — gets an entry of its own in the file list and the diff, holding only its threads. Once
such a thread is resolved, the entry is gone.** (2026-11-02, owner: "it's a big problem of mine, a thread interests
me or is unresolved, but it's outdated, so I simply don't see it"; placement by search agreed after the rightsize
pass) A thread on the deleted side is searched for in the file as it was before. (agent, 2026-11-03)

## D16

Retired 2026-11-04, replaced by the current [D16](../DECISIONS.md#d16): `J` / `K` go through a review's stack first, stacked PRs D26 having made a collapsed stack one step elsewhere.

**In review, `J` / `K` move to the next and previous pull request exactly as they do in an opened pull request
today, and `[` / `]` move between files. The stack's map sits at the top of the review, one click per pull request,
and the command palette goes to any of them. Review is a full-screen route of its own, so Back returns; one key
opens it from an opened pull request; `x` and `{` / `}` select files in the list ([D10](#d10)); another pair of keys
jumps between threads; a pull request opened for the first time lands on its first file not yet viewed, otherwise on
the remembered position ([D14](#d14)).** (2026-11-02, owner: `J` / `K` and `[` / `]` for consistency with the pull
request view; the rest the agent's proposal, confirmed after the rightsize pass)
