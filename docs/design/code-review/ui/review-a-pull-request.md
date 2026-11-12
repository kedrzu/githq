# Reviewing a pull request

## Purpose

githq lists, opens, merges and walks stacks of pull requests, but until now sent the user to github.com to review
the code. This path brings the review itself into githq: reading the changes file by file, reading every comment on
the code where it belongs, and, in the second step, writing comments and submitting a review. Everything written is
an ordinary GitHub review, visible on github.com at once.

The user arrives from an opened pull request (one key), often one of a stack of three or four written by a coding
agent, or from a list of pull requests. They usually go through a whole stack in a row, then the next one.

It is built in two steps, and both are drawn now. First, reading, plus warnings about open draft reviews. Then
writing.

## The user's task

"Let me read what changed, quickly, without losing my place or any comment. Skip what nobody reads, tick off what I
have read, and move on to the next pull request of the stack. When I comment, make it reach the author, often an
agent waiting for it."

What github.com gets wrong for this user, and what these screens must visibly get right:

- Clicking a comment lands in the wrong place.
- Large pull requests stutter.
- The pull request's own conversation is not visible while reading code.
- "Hide whitespace" must be ticked again on every pull request.
- Moving to the next pull request of a stack takes two clicks and loses the reading position.
- Outdated threads and comments in collapsed files disappear from view.
- A draft review started without noticing blocks everything: until it is submitted, its comments reach nobody, and
  the agent can neither see them nor reply.

## Screens, in order

1. **Entering a review.** From an opened pull request, one key opens its review. The review always takes the full
   screen, never the side panel or the modal an opened item can use. It is a page of its own, so Back returns.
2. **The review.** It answers one question: *what changed here, and what has been said about it?* It has four parts:
   - **The stack**, if the pull request is in one: every pull request of the stack, one click each.
   - **The file list**, on one side.
   - **The diff**, the main area.
   - **The pull request's conversation** (comments on the pull request rather than on a line, and review summaries)
     in a sidebar the user switches on and off. The choice is remembered, typically on for a large screen and off
     for a laptop.
3. **The view options:**

   - split (before and after side by side) or unified;
   - hide whitespace changes;
   - show comments in collapsed files (on by default);
   - the conversation sidebar.

   All of these are remembered for every pull request, not per pull request.
4. **Moving on.** `J` / `K` go to the next and previous pull request. Within a stack that is the next one in the
   stack; after the last one it continues into the next entry of the list the user came from. Clicking a pull request in the stack goes there too. Coming back to a pull request
   returns the user to exactly where they were reading.
5. **An open draft review** (first step). While the user has an unsubmitted draft review on this pull request, the
   review must say so in a way that is impossible to miss, with how many comments are waiting. Lists of pull
   requests mark every pull request with the user's open draft. The app's sidebar gains an entry listing those pull
   requests, present only while there is at least one. In the first step the drafts are still written on github.com;
   these warnings exist to catch exactly those.
6. **Writing** (second step):
   - a comment on one line or a range of lines;
   - a reply in a thread, and resolving a thread;
   - submitting a review as a comment, an approval or a request for changes, with a summary.
7. **Settings** (second step). One setting chooses what a comment does by default: go out at once as a single
   comment, or join a draft review. It sits in the Code review section of the settings screen.

## What's on each screen

**The file list**, by importance:

- Every changed file, with its path, how it changed (added, modified, deleted, renamed from another path) and its
  size in lines added and removed.
- Whether the user has marked it viewed. The mark is GitHub's own, and GitHub removes it when the author changes the
  file again, so a second round of review shows only the files changed since.
- Whether it has comments, and whether any thread on it is unresolved: open threads in amber, or the count in grey when all are resolved.
- Whether it starts collapsed because it is generated (lock files, generated code) or very large.
- **A filter.** It is a path pattern with wildcards, as in VS Code's file filters: `.png` means the extension,
  `docs/**/*.png` a folder and an extension. A toggle button with an icon, as in VS Code, switches the pattern to a
  regular expression. Next to it is a filter hiding viewed files.
- **Hiding viewed files.** With it on, ticking a file viewed removes it from the list and from the diff at once, and
  the next file takes its place on screen. That jump is wanted. A file with an unresolved thread is never hidden this
  way. It stays, showing only its threads.
- **Selecting several files.** Click, Shift+click for a range, Cmd+click to add one. From the keyboard: `x` toggles
  a file and `{` / `}` extend the selection. One action, first of all "mark viewed", applies to all of them. Users
  often tick ten uninteresting files at once.
- **Entries for gone files.** A file that is no longer in the diff but still has threads gets an entry of its own.
  That covers one created and deleted again within the pull request, so the diff shows nothing. The entry holds only
  its threads and disappears once they are resolved. A file simply deleted is an ordinary file with its diff in red.

**The diff**, by importance:

- **The changed lines of each file**, with a few lines of context above and below each change. The context can be
  expanded further, step by step or whole. Files follow one another; `[` / `]` go to the previous and next file.
- **Threads, beside the line they belong to.** A thread is its comments (markdown, possibly images and code), who
  wrote them, and whether it is resolved.
- **Outdated threads.** A thread whose code has changed since it was written is marked outdated. It sits where its
  line is now if that line can still be found, otherwise at the top of its file, showing the old code it was written
  on. The user must be able to tell that its place is approximate.
- **Threads on lines that are not shown.** These are lines inside collapsed context, or whitespace changes the user
  hid. Each such thread is shown with one to three lines of code around it and a mark saying how far it is from the
  rest. Nothing in between is expanded.
- **Collapsed files.** A collapsed file (generated, very large, viewed, or collapsed by hand) shows its header,
  why it is collapsed, and under it only its threads, each with the few lines of code it was written on. It
  expands whole and collapses back again; github.com cannot collapse such a file again without hiding its comments.
- **Moving between threads.** A separate pair of keys jumps from thread to thread, and a jump lands exactly on its
  target. Clicking a thread in the file list or in the conversation also jumps.
- **First open.** A pull request opened for the first time starts at its first file not yet viewed.

**The stack**, by importance: the pull requests in reading order (first to last), which one is open, each one's
state (checks, review, merged), and which ones have the user's open draft.

**Writing a comment** (second step):

- **Two keys.** `Cmd+Enter` does the default chosen in settings: a single comment sent at once, or adding to the
  draft review. `Cmd+Shift+Enter` does the other.
- **While a draft is open on this pull request**, a single comment is impossible: GitHub accepts nothing else from
  the user there. Then `Cmd+Enter` adds to the draft, and the second key adds the comment and submits the whole draft
  at once. The button must say exactly that, with the count: "Submit draft (4 comments)".
- **A suggested change** can be inserted into a comment, prefilled with the selected lines. Applying someone's
  suggestion is not offered and stays on github.com.

## States

- **First open of a large pull request.** The list of files arrives first, and each file's content arrives on its
  own, shortly after. The user should be able to start reading the first files while the rest are still coming.
- **Collapsed or not, not known yet.** Whether a file is generated is known only once the repository's
  `.gitattributes` has been read, which can arrive just after the file list. A file must not visibly flip from
  expanded to collapsed under the user.
- **Jumping to a file not computed yet.** There is a short wait for that one file. The jump then lands exactly on
  the target and stays there while the rest fills in around it.
- **Returning to a pull request.** The user is at the same line as before. The same holds after switching between
  split and unified, or hiding whitespace. The files they expanded or collapsed, their filter and their expanded
  context are as they left them.
- **The author pushed since the user was last here.** Files changed since are no longer marked viewed, and expanded
  context in those files is reset.
- **Everything viewed.** With viewed files hidden, the list and the diff are empty, apart from files with unresolved
  threads. That is the moment to submit or move on.
- **A pull request with no changes**, and **one with only binary files.** A binary file has no diff to show.
- **Very many files.** GitHub returns at most 3,000 changed files per pull request, and the user must be able to see
  that the list is cut off.
- **Threads only, no code.** The entry for a file that is gone from the diff.

## Failures that must be visible

- **An open draft review**, above all. On this pull request it must be impossible to miss, in lists it is a mark,
  and in the sidebar an entry. A draft started on github.com may show up in githq only after a delay.
- **A file whose content could not be fetched**, or that is too large to diff. Say so in place, with a way to open
  the file on github.com.
- **An outdated thread whose line could not be found.** Shown at the top of its file, with its old code. It must not
  look as if it belonged to the code it now sits next to.
- **Submitting failed** (second step). Comments must never be silently lost.
- **GitHub's API limit reached** while files are still loading.

## Technical constraints

- **Files arrive one by one.** githq computes the diff itself from each file's content before and after. Contents
  arrive per file, not all at once. The list of changed files, with paths and sizes, arrives first.
- **Only what is on screen is drawn.** Heights of what is off screen are estimates, so the scrollbar may adjust
  slightly while scrolling. What the user is looking at never moves.
- **Generated files are not marked by GitHub.** githq reads them from the repository's root `.gitattributes` and
  from a list of well-known lock file names.
- **Viewed marks and threads are GitHub's**, so they agree with github.com both ways.
- **The draft review exists only on GitHub** and is visible only to its author. A draft started on github.com may
  show in githq late, and drafts on pull requests githq does not hold are not found.
- **There is no diff across a whole stack.** Each pull request shows only its own changes.
- **Not part of this design:** applying suggestions, a combined diff across a stack, and fetching files ahead of
  time.

## Questions this design should settle

1. **The open draft warning.** How it is impossible to miss on the review without getting in the way of reading,
   how a pull request is marked in a list, and what the sidebar entry looks like.
2. **The file list.** Whether it can be hidden like the conversation sidebar. The owner did not say, and the agent
   assumes yes. And how "viewed" shows: an icon or a colour.
3. **Stack and file list together.** Where the stack sits so that one click per pull request stays one click,
   without taking width from the diff.
4. **Code shown out of place.** How a piece of code shown out of place reads: the distance mark, and a collapsed
   file showing only its threads.
5. **Outdated threads.** How an outdated thread shows that its place is approximate, and how the entry for a gone
   file differs from a real file.
6. **The view options.** Where they live, given they are set rarely and remembered.
7. **Writing.** How the comment box makes clear what each of its two keys will do, in both settings and with a
   draft open.

## The screens

In `githq.pen`, frame **"App · Code review"** (`CEDLB`). The numbers are the frame's. No variants are waiting. Decisions: [DECISIONS](../DECISIONS.md), D24 onward.

|Question|Answer in the frame|
|-|-|
|1. The open draft warning|A toolbar at the foot of the diff, in a stack and outside one: CR35, CR36; asking before discarding CR39 and before submitting CR75; the stack row's dot CR35; lists CR33; the sidebar entry and its list CR33, CR34|
|2. The file list hidden, and how viewed shows|⌘B, as the conversation's ⌥⌘B: CR6, CR50; files indented under their folder, an eye after a viewed file's name: CR46|
|3. Stack and file list together|The stack's rows on top of the file list: CR47; scrolled, a thin pinned bar and the filter under it: CR48|
|4. Code shown out of place|The distance mark: CR11; a collapsed file with only its threads: CR12, expanded CR13|
|5. Outdated threads and gone files|Placed approximately: CR2; line gone: CR10; a gone file: CR14|
|6. The view options|One button naming layout and whitespace, a menu: CR50|
|7. Writing|CR70 (single by default), CR71 (draft by default), CR72 (draft open); the box itself CR90–CR93, Cancel CR97, CR98 (D39, D40)|

Reading: an opened pull request and D, CR1; large screen split with the conversation CR2, unified without it CR3;
laptop split CR4, unified with the conversation CR5, both columns hidden CR6. Threads: CR10–CR15 (jumping between
threads CR15). Settled by the owner: the pending review's toolbar (CR35, CR36, D28), where the stack sits (CR47, CR48, D25), the viewed mark (CR46, D27) and the comment setting being synced (CR77, D34). The walk: first open CR20, viewed hidden CR21, V and the next file CR22, ten selected CR23, ticked at
once CR24, J CR25, K back CR26, path pattern CR27, regular expression CR28, the keys CR29. States and failures:
files arriving CR60, jumping ahead of them CR61, pushed since CR62, everything viewed CR63, no changes CR64, only
binary CR65, the 3,000-file cut-off CR66, a file not fetched or too large CR67, the API allowance CR68, a file still arriving in split CR88 and unified CR89 (D38). Writing: a
range with a suggestion CR73, reply and resolve CR74, submitting CR75, submitting failed CR76, the setting CR77 (in App · Settings).

Refined 2026-11-10 (D39–D45): the comment box on the shared editor CR90, a range with a draft open CR91, a reply CR92, unified after a push and refused CR93; Esc asking CR97 and a toast giving a discarded comment back CR98; 8 px between files CR99; hidden lines with gutter arrows CR103; the number as the hover affordance CR106; the current file lit CR108; placeholders from the patch CR111, a guessed height reserved with grey bars CR113, a first open before the patches arrive CR115, and a too-large file's bars turning into its note CR116.

Found while building: a collapsed stack holding your draft CR78, syntax colours CR79, GitHub not showing the pull request CR80, a file GitHub hasn't listed CR81, older reviews CR82.

Still open, not settled by the screens:

- **Placeholders:** the size past which a file isn't diffed (CR67, D35) and GitHub's error wording (CR67, CR76).
- **The second key while a draft is open** (D22): ⌘⇧↵ in the comment box still sends the whole draft at once, named on its button, without the dialog of CR75.
- **Wording left as it was:** lists still say "Your draft review · 3 comments unsent" (CR33, CR34), and writing says "Add to draft" and "Submit draft" (CR72). The owner has reworded the toolbar and named the sidebar entry "Draft reviews".
