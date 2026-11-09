# Pull requests and reviews

A pull request opens on a page that says where it stands: whether it can merge, and what holds it back. From there you
can review its files line by line, submit the review and merge it, without going to github.com.

Keys with <kbd>⌘</kbd> use <kbd>Ctrl</kbd> on Windows and Linux.

## A pull request's page

Open a pull request from any list with <kbd>Enter</kbd>, or by its address, `/owner/name/pull/123`. It shows in a panel
beside the list, in a modal over it, or on a full page, whichever you used last. See
[Open an item](./my-work.md#open-an-item).

The header holds the way through the list you came from (<kbd>K</kbd> and <kbd>J</kbd>, with your place, such as
`3 / 13`), the switch between panel, modal and full page, **Open on GitHub** (<kbd>O</kbd>) and **Close**
(<kbd>Esc</kbd>). The pull request's reference, such as `acme/portal #1187`, opens the item menu: every action you may
take on it, each with its key. <kbd>⌘</kbd> <kbd>.</kbd> opens the same menu.

### Where it stands

The page leads with a one-line verdict, such as **Ready to merge**, **Can't merge yet** or **Being merged**, and what
holds it back: failing or running checks, a review still missing or asking for changes, conflicts with the base branch,
a branch behind its base. Then its branches, its size, and the ways on:

- **Merge…** (<kbd>Shift</kbd> <kbd>M</kbd>) opens the merge panel. Its label names the way forward when there is one,
  such as **Update branch**, **Resolve on GitHub** or **Queue…**. Without write access to the repository, it reads
  **You can't merge in this repository**.
- **Review files** (<kbd>D</kbd>) opens the code review. <kbd>Shift</kbd> <kbd>O</kbd> opens the changed files on GitHub
  instead.

Once githq has read the base branch's rules, the verdict weighs only the required checks, and a required check is tagged
**Required**.

### Checks

**Checks** counts the checks of the latest commit, failing, running, passed and skipped. Failing ones come first, each
with how long it ran and a **Log** link to GitHub; the ones that passed fold into one row.

### Reviews

**Reviews** lists each reviewer's latest review, then the people asked who haven't answered. **Request**
(<kbd>Shift</kbd> <kbd>R</kbd>) asks more people for a review.

### Comments and properties

The latest comments follow, with **Show all** for the rest. <kbd>R</kbd> puts the cursor in the comment box, and
<kbd>⌘</kbd> <kbd>Enter</kbd> posts. Assignees, labels and milestone have their keys too: <kbd>A</kbd>, <kbd>L</kbd>,
<kbd>M</kbd>. <kbd>Shift</kbd> <kbd>X</kbd> closes or reopens.

### Other commands

When they apply, a pull request's ordinary commands are in its menu and the command menu, each with a key:

|Key|Command|
|-|-|
|<kbd>U</kbd>|**Update branch**, by merge|
|<kbd>Shift</kbd> <kbd>U</kbd>|**Update branch by rebase**|
|<kbd>Shift</kbd> <kbd>E</kbd>|**Re-run failed checks**|
|<kbd>Shift</kbd> <kbd>D</kbd>|**Delete branch**, or **Restore branch**, once it is merged or closed|
|<kbd>Shift</kbd> <kbd>Z</kbd>|**Revert**, which creates a new pull request|
|<kbd>Shift</kbd> <kbd>Q</kbd>|**Take out of queue**|

The item menu also has **Convert to draft** or **Mark ready for review**, **Copy branch name** and **Copy link**.

## Merging

<kbd>Shift</kbd> <kbd>M</kbd> opens the merge panel, from the pull request's page or from its row in a list. It answers
two questions: can this merge now, and how will it land?

- **The verdict and the checks**, the required ones marked.
- **The method**: only those the repository and the base branch allow, on <kbd>1</kbd>, <kbd>2</kbd> and <kbd>3</kbd>.
- **The commit text** GitHub proposes. <kbd>E</kbd> edits it.

<kbd>⌘</kbd> <kbd>Enter</kbd> always takes the way forward: it merges, or first marks a draft ready, updates a branch
that must be up to date, turns on auto-merge where it waits for checks, or adds the pull request to a merge queue.
Conflicts are resolved in GitHub's editor. If the repository's rules let you merge past what isn't met, the panel says
what you would skip, and only <kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>Enter</kbd> (<kbd>Ctrl</kbd> <kbd>Alt</kbd>
<kbd>Enter</kbd> on Windows and Linux) does it. <kbd>Esc</kbd> closes the panel.

::: info
Nothing shows as merged until GitHub says so. If GitHub refuses, the panel keeps your text and shows GitHub's reason, and
<kbd>⌘</kbd> <kbd>Enter</kbd> tries again.
:::

### Stacks

A stack is a chain of pull requests where each builds on the one before. In lists, a stack is one entry. An opened pull
request of a stack shows the stack's map: every pull request first to last, with its state, this one highlighted. Click
a row to open that pull request in its place.

Merging from a stack's entry takes the whole stack; merging from one of its pull requests takes everything up to it. The
panel lists them first to last, and <kbd>↑</kbd> and <kbd>↓</kbd> move where the merge stops. They land together, first
to last.

githq doesn't link pull requests into a stack, or rebuild one: do that on GitHub.

## Code review

**Review files** (<kbd>D</kbd>) opens the review on a page of its own, at GitHub's address of a pull request's changed
files, `/owner/name/pull/123/files`. The list of files is on the left, and the diff of every file fills the rest, one
after another. The review opens where you left it, or the first time on the first file you haven't viewed.

Press <kbd>?</kbd> for **Keys in a review**, all of them on one sheet.

### Moving

|Key|What it does|
|-|-|
|<kbd>]</kbd> / <kbd>[</kbd>|Next or previous file|
|<kbd>N</kbd> / <kbd>Shift</kbd> <kbd>N</kbd>|Next or previous comment thread, unresolved ones first|
|<kbd>↓</kbd> / <kbd>↑</kbd>|Line by line|
|<kbd>J</kbd> / <kbd>K</kbd>|Next or previous pull request of the list you came from|
|<kbd>Esc</kbd>|Back to the pull request|
|<kbd>O</kbd>|Open the pull request on GitHub|

A pull request of a stack shows the stack above the files, and a click on a row opens that pull request's review.

### The diff

The view options, in the toolbar and in the command menu, set:

- **Layout**: **Split**, old and new side by side, or **Unified**.
- **Hide whitespace changes**.
- **Comments in collapsed files**.

githq keeps them for every pull request, on this device. <kbd>⌘</kbd> <kbd>B</kbd> hides or shows the file list, and
<kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>B</kbd> shows the pull request's conversation at the right.

Lock files, generated files and very large files start collapsed. <kbd>Space</kbd>, or a click on a file's header,
collapses or expands a file. <kbd>/</kbd> filters the files by path, such as `*.ts` or `docs/**`, or by a regular
expression.

### Viewed files

<kbd>V</kbd> marks a file viewed, or not viewed. It is GitHub's own mark, so github.com shows it too. A viewed file
collapses to its header, and the eye in the file list hides viewed files altogether. To mark several at once, select
them with <kbd>X</kbd>, extend the selection with <kbd>}</kbd> and <kbd>{</kbd>, or click with <kbd>Shift</kbd> or
<kbd>⌘</kbd>, then press <kbd>V</kbd>.

A file with an unresolved thread is never hidden as viewed. When a push takes the viewed mark off files, a line over the
review names them, with **Show only these**.

### Comments

<kbd>C</kbd>, or a click on a line's number, opens a comment box under that line. Drag over the numbers, or
<kbd>Shift</kbd>-click, for a range; <kbd>Shift</kbd> <kbd>↓</kbd> in an empty box takes in the next line.
<kbd>⌘</kbd> <kbd>G</kbd> inserts a suggested change, where GitHub would take one.

The box has two buttons, one on <kbd>⌘</kbd> <kbd>Enter</kbd> and the other on <kbd>⌘</kbd> <kbd>Shift</kbd>
<kbd>Enter</kbd>:

- **Comment** sends a single comment that reaches the author at once.
- **Start a review** starts a draft review with this comment in it.

Which one is on <kbd>⌘</kbd> <kbd>Enter</kbd> is yours to choose, in **Settings → Code review**. By default it sends
the comment at once. With drafts first, the other button reads **Comment now**.

<kbd>R</kbd> or **Reply…** answers a thread. **Resolve** folds it; **Unresolve** opens it again.

### Your draft review, and submitting

While you have a draft review, comments join it: the buttons read **Add to draft** and **Submit draft**. A toolbar at
the foot of the diff counts your pending comments, which others can't see until you submit, with **Discard review…** and
**Submit review…**.

**Submit review…** (<kbd>Shift</kbd> <kbd>S</kbd>) opens a dialog: an optional comment on the pull request, and what the
review is, **Comment**, **Approve** or **Request changes**, on <kbd>1</kbd>, <kbd>2</kbd> and <kbd>3</kbd>.
<kbd>⌘</kbd> <kbd>Enter</kbd> sends it. If GitHub refuses, everything you wrote is kept, with **Try again**.

A draft stays on GitHub until you submit or discard it. Every pull request with your draft is listed in
[Draft reviews](./my-work.md#draft-reviews).
