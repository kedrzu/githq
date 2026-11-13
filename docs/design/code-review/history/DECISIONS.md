# Retired decisions

Decisions that held once, in full, under their original IDs. Never edited after they are written, apart from adding
the next retired form.

## D32

Retired 2026-11-13, replaced by the current [D32](../DECISIONS.md#d32): its "no line cursor" paragraph: ↓ ↑ now move a line cursor (D44).

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

## D43

Retired 2026-11-13, replaced by the current [D43](../DECISIONS.md#d43): hover no longer lights the number alone: it moves the line cursor, whose line shows a comment button.

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

Retired 2026-11-13, replaced by the current [D44](../DECISIONS.md#d44): the current file is the line cursor's file, not the file at a reading line.

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
