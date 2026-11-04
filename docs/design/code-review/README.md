# Code review in githq

> Closed 2026-11-02, ready to build the first step.

## What this is

Reviewing a pull request — reading its changes file by file, reading and writing comments on lines, and approving
or asking for changes — done in githq instead of on github.com's "Files changed" page. githq already lists, opens,
merges and walks stacks of pull requests; until now it sent you to github.com for the review itself. Everything
written here is an ordinary GitHub review, visible on github.com straight away.

## Why

The owner spends much of the day reviewing pull requests, many of them written by coding agents and delivered as
stacks. github.com's review screen gets in the way of that in specific, repeated ways:

- Clicking a comment beside a file sometimes lands somewhere else, because the page guesses wrong where that
  comment falls in a long, lazily drawn page.
- Large pull requests stutter: scrolling is slow, and a big file freezes the page while it is drawn.
- While reading the code you cannot see the pull request's own conversation, the comments made on the pull request
  rather than on a line.
- "Hide whitespace" has to be ticked again on every pull request.
- Moving to the next pull request of a stack takes two clicks, and you arrive at the top of it, having lost the
  place where you were reading.
- Threads on code that has since changed ("outdated") are easy to lose, and so are comments in files the page has
  collapsed.
- Once you start a draft review, a single comment can no longer be posted. A draft started without noticing keeps
  every comment unsent: the agent on the other side does not see them, and cannot reply or comment until the draft
  is submitted.

## What is different once it exists

You open a pull request of an agent's stack and press one key. The review fills the screen: the files on the left,
the diff in the middle, the pull request's conversation on the right if you keep it switched on. Lock files and
generated code are already collapsed. You read, tick files as viewed, and they leave the list; ten uninteresting ones
you select with Shift+click and tick at once. A comment from earlier sits next to the line it was about, even though
that code has moved since. `J` takes you to the next pull request of the stack; `K` brings you back exactly to the
line you were reading. You write a remark and it goes out as a single comment, or into a draft, whichever you set as
your habit — and while a draft is open, a banner you cannot miss says so, and the pull request carries a mark in every
list until you send it.

## A screen of its own

A review only ever takes the full screen, never the side panel or the modal an opened item can use: a diff needs the
width, more so when it is split into the file before and after. [Full screen only](DECISIONS.md#d2). It shows the
changes either split side by side or unified, as github.com does ([both layouts](DECISIONS.md#d3)). The pull
request's own conversation can sit in a sidebar beside the diff, switched on and off by hand and remembered — on a
large screen you leave it on, on a laptop off. [Why a switch and not the window's width](DECISIONS.md#d5).

## githq computes the diff itself

GitHub can hand over a ready-made diff, but no GitHub API can leave out whitespace changes, and the patches it hands
over stop at the lines around each change. Both things the owner wants — whitespace hidden by a remembered setting,
and context around a change that can be expanded further — need each file as a whole. So githq fetches every changed
file as it was before and as it is after, and works out the differences itself. Hiding whitespace then becomes a
setting kept once rather than per pull request. [Our own diff, and what GitHub's APIs offer](DECISIONS.md#d6).
[Whitespace remembered](DECISIONS.md#d4).

## Not every file is read

Some files nobody reads: lock files, generated code. Those start collapsed — githq recognises them by the
repository's own `.gitattributes`, where they are marked generated, and by the names of well-known lock files — and
so do very large files. A collapsed file costs nothing: it is not even fetched until you open it, which is also how
a huge pull request stays quick. [Which files start collapsed](DECISIONS.md#d8).

The rest you read and tick as viewed. That mark is GitHub's own, so it agrees with github.com, and GitHub drops it
when the author changes the file again — a second round of review shows only what changed since you read it. The
file list shows which files are viewed and filters them out if you ask, so it shrinks as you go: ticking a file
removes it, and the next file takes its place on screen. [Viewed files](DECISIONS.md#d9). You can select several
files and tick them at once ([selecting files](DECISIONS.md#d10)), and narrow the list by a path pattern written as
in VS Code — `.png`, or `docs/**/*.png` — with a toggle for a regular expression
([the filter](DECISIONS.md#d11)).

## Every comment stays visible

Hiding things is useful only if it never hides a conversation. So each thread is shown with its code wherever it
is.

A thread on code that has changed since is still shown in its file. GitHub sends each comment with the few lines of
code it was written on, so githq looks for the commented line in the file as it is now; found exactly once, the
thread sits there, otherwise at the top of its file with the old code beside it. Either way it is marked outdated. A
thread on a file that is gone from the diff — created and deleted again within the pull request — gets
an entry of its own in the file list, until it is resolved. [Outdated threads](DECISIONS.md#d12).

A thread on a line you cannot see — inside collapsed context, on a whitespace change you hid, in a collapsed file —
is shown with a line or three of code around it and a mark saying how far it is from the rest, instead of expanding
everything in between. A collapsed file shows just those pieces under its header, with the code as it was when the
comment was written, so the file still is not fetched; it expands whole and collapses back. [Comments on hidden lines](DECISIONS.md#d13). And a file with an unresolved thread is never filtered out as
viewed: a colleague's new comment on a file you already ticked would otherwise appear nowhere.
[Unresolved threads stay](DECISIONS.md#d15).

## Landing in the right place

A long diff cannot be drawn all at once, so only the part on screen is drawn and the heights of the rest are
estimated. Comments make that estimate unreliable: their markdown, images that load late and wrapped lines all have
heights nobody knows before drawing them. github.com jumps to an estimated position and misses. githq does it the
other way round. It draws the target first and holds it where it belongs on screen. When something above turns out
taller or shorter than estimated, the scroll position absorbs the difference, so what you are looking at does not
move. The estimates only steer the scrollbar.

"Where you are" is therefore recorded as a thing — a line of a file, or a comment — and its distance from the top of
the screen, never as a number of pixels. That survives switching the layout, hiding whitespace and expanding
context, and it is what githq remembers for each pull request, together with which files you expanded or collapsed,
your filters and expanded context. Leave a pull request halfway and come back, and you are where you were.
[Jumping and remembering the place](DECISIONS.md#d7). [What is kept per pull request](DECISIONS.md#d14).

## Moving through a stack

In a review `J` and `K` walk the pull requests of the stack, then on along the list you came from: the next stack, as one
step. Files are `[` and `]`. The stack's map sits at the top of the review, one click per pull
request, and the command palette goes to any of them. [The keys](DECISIONS.md#d16).

## Writing a review

People review in two ways: some collect comments in a draft and send one review at the end, others send each remark
as it comes. github.com pushes everyone into the first as soon as a draft is started. In githq a setting chooses
which one `Cmd+Enter` does, and `Cmd+Shift+Enter` does the other. [Single comments and drafts](DECISIONS.md#d17).

GitHub takes no other comment on a line from you on a pull request while your draft there is open, so with a draft
open a comment can only join it — and the second key adds it and sends the whole draft at once, saying how many comments go
([sending the draft](DECISIONS.md#d22)). An open draft is impossible to miss: the review says so prominently, lists
mark the pull request, and the app's sidebar lists the pull requests with your drafts whenever there are any.
[Open drafts](DECISIONS.md#d21).

A suggested change can be written, since it is just a block of markdown in the comment. Applying someone's
suggestion stays on github.com, because GitHub offers no API for it. [Suggestions](DECISIONS.md#d18).

## Speed

github.com stutters on large pull requests, so in githq speed is the only criterion for how the work is split, ahead
of effort or complexity. Only the lines on screen are drawn, never a whole file. Whether computing the diff, the
syntax colours and where threads go moves to a Web Worker, which would send the screen only the rows about to be
drawn, is settled by measuring both on a large pull request, with WebAssembly only where JavaScript proves to be the
bottleneck. [Measured, not assumed](DECISIONS.md#d20). Files are fetched when a review is opened and kept in the
browser's database by their content's id, which never changes, so a pull request read once reopens at once;
fetching ahead of time for pull requests waiting on you may come later ([fetching](DECISIONS.md#d19)).

## What this leaves out

Applying suggestions, a combined diff across a stack (GitHub has none either), and fetching files ahead of time.

## Where this stands

The design is closed, with nothing open. The screens are in [the brief](ui/review-a-pull-request.md).
