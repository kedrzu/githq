# Checking what's on my plate and acting on it, on a phone

The brief for the first screens of githq on a phone, drawn on top of the navigation already settled there. The product,
its data and Direction D are in [the app's brief](../../githq/ui/README.md); what My work holds and what can be done to
an item, on the computer, is in [the desktop's version of this path](../../githq/ui/my-work.md) — read it, this file
only says what is different on a phone. The rules for the design file are in the `design` skill.

## Purpose

This is the path githq on a phone exists for: away from the computer, see what needs you across every repository, open
it, and deal with it — reply, reassign, move it in a project, close it. The user arrives on My work, which is where
githq opens.

## What is already settled, and drawn in `App · Mobile`

Build on it; don't redraw it as variants.

- **No bottom tab bar.** A command line floats over the bottom of every screen. On a list it is one wide button with ⌘
  and a chip naming the part you are in (My work's group, a repository's section, a project's view) with its count. On
  an item it is the comment box and ⌘, side by side.
- **The command menu rises from below**, input at the bottom, the first results nearest the thumb, no keyboard until
  the input is tapped. On an item it starts from that item and its actions.
- **The ⌘ button leaves inside a task** — writing a reply, picking a value, creating an issue — and comes back when the
  screen is at rest; a draft stays in the comment box.
- **Top-left:** on a list it opens the places as a panel from the left; on an item it is back, with the name of the
  list it returns to.
- **Top-right:** the list's options (filter, sort, group) and New issue on a list; previous and next on an item.
- **Not fresh:** a strip under the top bar when something is off, a toast above the command line for a failed edit.
- **A link githq does not show on a phone** (a commit, a pull request's changed files, merging) carries ↗ and opens on
  github.com.
- **No edge swipes** open anything, and there is no board on a phone.

## The user's task

"What needs me? Open it, read what happened, and answer or move it along — with one thumb, in a minute between other
things."

## Screens, in order

1. **My work**, one group at a time, with the filters Needs me / Waiting on others / All. It answers: *what needs me
   first?*
2. **The row, at a phone's width.** The desktop row carries the repository, number, title, author, labels, assignees,
   the project's row field ("In progress +1"), and for a pull request its checks, review state and draft. At about
   350 px of usable width most of that does not fit. Decide what stays, what shrinks to an icon, and what is only in
   the item. A pull request nested under the issue it closes still has to read as nested.
3. **An issue, opened.** Title, state, the repository and number; its properties (assignees, labels, milestone, type);
   every project it is in with that project's fields; the body; the activity; the comment box at the bottom. It
   answers: *what is this, and what happened since I last looked?* On the computer the properties sit in a side column;
   here everything is one column, and how far the comments are from the top is the question.
4. **A pull request, opened.** The same, plus: where it stands — mergeable, blocked by checks, by reviews or by
   conflicts — the checks (a failing one links to its log on github.com, ↗), the reviewers and their latest verdicts,
   branches, draft, size, the issues it closes, and its stack when it is part of one. Merging and the changed files are
   not on a phone: they are ↗ to github.com.
5. **Changing a property**: assignees, labels, a project field's value, close or reopen (completed or not planned),
   request a reviewer, mark ready for review. On the computer these are submenus of the command menu, the item's menu
   and a right-click menu, all with the same entries.
6. **Replying**: the comment box expanded, the phone's keyboard up, sending, and the comment appearing at once.
7. **Back to My work**, at the same place in the list, and on to the next item.

## States

- **An edit GitHub rejected** (no permission to label in someone else's repository): it is undone, and the user sees
  which edit failed and why. Must be visible.
- **The item's body and activity not here yet.** Lists come from the copy on the device, but an item's text and
  comments are fetched when it is first opened, unless it is in My work, where they are fetched ahead. Opening
  something else for the first time shows its title and properties at once and the rest a moment later.
- **Nothing needs me**: a good state, not an error.
- **A very long thread**: a pull request with eighty comments and review events.

## Technical constraints

- Every change shows at once and is sent to GitHub behind the scenes; there is no saving state to design for a single
  edit, only the failure above.
- What may be done depends on the user's permissions in that repository; an action they may not take is not offered,
  and the item says in one line what is missing and why, as on the computer.
- Each item has its GitHub address; back is the browser's back, or the hybrid app's.

## Questions this design should settle

Draw each as variants side by side, Variant A the one you recommend, as the `design` skill says. Propose others if you see
them.

- **How a property is changed.** Tapping the property on the item opens the command menu straight at its picker (one
  mechanism, the one the phone already has), against a picker of its own that slides up from the property, against
  editing only through ⌘.
- **How the properties sit on an item.** All of them at the top, against one compact summary line that opens them,
  against after the body. What decides it is how much scrolling stands between opening an item and its latest comment.
- **Acting on a row without opening it.** The computer has a right-click menu on a row. On a phone: a long press that
  opens the command menu with that row as its subject, against swiping a row sideways to reveal two or three actions,
  against nothing — open the item first. Swiping a row is not an edge swipe, but it is a gesture nobody can see, and the
  owner is wary of gestures.
- **Selecting several items** at once is on the computer. Whether a phone has it in the first version at all; if drawn,
  how you get into it and out.
- **Where the item's place in a pull request's stack goes**, if it does not fit as on the computer.

## Where to draw it

In `App · Mobile`, the next codes of its letters (MB), reusing its components and Direction D's.
