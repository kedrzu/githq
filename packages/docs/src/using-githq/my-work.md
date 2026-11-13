# My work

My work is githq's home screen: every open issue and pull request on GitHub that waits on you, in one list. It covers
every repository, tracked or not, including other people's.

## What it collects

githq asks GitHub's search for four things, and each becomes a group of My work:

|Group|What it holds|
|-|-|
|**Review requested**|Open pull requests that ask for your review|
|**My pull requests**|Open pull requests you opened|
|**Assigned to me**|Open issues assigned to you|
|**Mentioned**|Open issues and pull requests that mention you|

An item shows once, in the first group that applies, in the order of the table. A pull request that asks for your
review and also mentions you is under **Review requested** only.

Closed and merged items leave My work. Nothing has to be tracked for an item to show here: see
[Choose what to track](../getting-started/choose-what-to-track.md#what-concerns-you-and-what-you-track).

### Pull requests under the issue they close

A pull request of yours that closes an issue assigned to you sits under that issue, not in **My pull requests**. The
issue and the work on it read as one row.

### Stacks

A stack of pull requests, each building on the one before, is one entry, in the first group any of its pull requests
belongs to. The entry starts collapsed. Press <kbd>→</kbd> to expand it and <kbd>←</kbd> to collapse it, or click its
chevron. On a board, <kbd>Space</kbd> does the same. When only one pull request of a stack is still open, it is an ordinary row, marked as part of its stack.

## Narrow it down

**The sidebar.** Under **My work** the sidebar lists the four groups with their counts. Choose one to see only that
group. Each group has GitHub's own address of the same list, such as `/pulls/review-requested` or `/issues/assigned`.

**The filters.** Three tabs at the top of the list:

|Key|Filter|What it keeps|
|-|-|-|
|<kbd>1</kbd>|**All**|Everything in My work|
|<kbd>2</kbd>|**Needs me**|Reviews asked of you, issues assigned to you, and your pull requests with failing checks, changes requested or conflicts|
|<kbd>3</kbd>|**Waiting on others**|Your pull requests waiting for a review or for checks still running|

A mention alone never counts as **Needs me**. When **Needs me** is empty, the screen says **Nothing needs you right
now** and tells you how many of your pull requests are waiting on others.

## Group, order and layout

The toolbar sets how My work is shown:

- **Group**: by **Reason** (the four groups above, the default), by **Repository**, by **Status** or by **Author**.
  Grouped by repository, your tracked repositories come first, in the sidebar's order, then **Other repositories**.
  Grouped by status, the groups are **Needs me**, **Ready to merge**, **Waiting on others**, **Draft** and **Other**.
- **Order**: newest first by default.
- **Properties**: what each row shows.
- **Layout**: a **List**, or a **Board** with a column per group. <kbd>Shift</kbd> <kbd>V</kbd> switches between them.

These choices are saved on this device only. Nothing on the board moves between columns: a reason or an author isn't
something you set.

## Open an item

Move through the list with <kbd>J</kbd> and <kbd>K</kbd>, or <kbd>↓</kbd> and <kbd>↑</kbd>. Press <kbd>Enter</kbd> or
click a row to open it. Press <kbd>O</kbd> to open the selected item on GitHub instead.

An opened item shows in a panel beside the list, which stays in view. Press <kbd>Enter</kbd> again, or
<kbd>Shift</kbd> <kbd>Enter</kbd>, to open it full screen, on its own page at the same address as on GitHub;
<kbd>Shift</kbd> <kbd>Enter</kbd> or <kbd>Esc</kbd> brings it back to the panel. In a window too narrow for the list
and the panel side by side, an item opens full screen straight away. The button beside **Open on GitHub** does the
same.

While an item is open, <kbd>J</kbd> and <kbd>K</kbd> step to the next and previous item of the list, and <kbd>Esc</kbd>
in the panel closes it and takes you back to the list, with the item still selected. Wide enough, the item shows in two
columns: where it stands, its reviews, checks and properties on the left, staying in place (drag the gap between
the two to widen it), and its history on the right. [Pull requests and reviews](./pull-requests-and-reviews.md) describes what a pull
request's page shows.

## Act from the list

Keys act on the selected row, without opening it:

|Key|What it does|
|-|-|
|<kbd>R</kbd>|Opens the item with the cursor in its comment box|
|<kbd>A</kbd>, <kbd>L</kbd>, <kbd>M</kbd>|Assignees, labels, milestone|
|<kbd>S</kbd>, <kbd>P</kbd>, <kbd>I</kbd>|Status, priority and iteration in its project|
|<kbd>Shift</kbd> <kbd>X</kbd>|Close or reopen|
|<kbd>Shift</kbd> <kbd>R</kbd>|Request reviewers of a pull request|
|<kbd>Shift</kbd> <kbd>M</kbd>|Merge a pull request you may merge|

githq offers only what your role in the repository allows. Right-click a row for its menu: every action, each with its
key, plus **Copy link**, **Add to project…** and **Open full screen**.

### Several items at once

Press <kbd>X</kbd> to select a row for editing together, and <kbd>Shift</kbd> <kbd>J</kbd> or <kbd>Shift</kbd>
<kbd>K</kbd> to select the next or previous one too. A toolbar shows what you can do to all of them: assign, label, set
a milestone or close. The same keys work on the selection. <kbd>Esc</kbd> clears it. If only some of the items can take
a change, githq says how many, such as `2 of 3 editable`, and leaves the others as they are.

Every change shows at once and goes to GitHub in the background. See
[Your edits](../how-it-works/github-is-the-source-of-truth.md#your-edits).

## Draft reviews

A code review you started and haven't submitted is a draft: only you see its comments. While you have one, the sidebar
shows **Draft reviews** with their count, above My work. The list holds each pull request with your draft, the one
waiting longest first.

Press <kbd>Enter</kbd> to open the review where the draft is, or <kbd>Shift</kbd> <kbd>S</kbd> to open it at the submit
dialog. See [Draft reviews and submitting](./pull-requests-and-reviews.md#your-draft-review-and-submitting).

## When it is empty

When every group has arrived and nothing is left, My work says so plainly. With nothing at all, it reads **Nothing on
your plate** and offers **New issue** and **Jump to a project**. An empty My work is an answer you can trust, not a
screen still loading: until GitHub's search answers, faded placeholder rows stand where the items will be.
