# Getting around githq on a phone

The brief for drawing githq's navigation on a phone. The product, its data and Direction D are in
[the app's brief](../../githq/ui/README.md); the rules for the design file are in the `design` skill. This file adds only what is different on a phone.

## Purpose

githq is drawn for a computer: a sidebar, a list and an opened item side by side, and everything reached from the
keyboard, the command menu with ⌘K above all. The owner wants access to all of their GitHub work from a phone that
is as comfortable as from the computer. This path is that: the same app in a window about 375–430 px wide, moved
around with a thumb.

The question for this round is **how you get around**: between places (My work, projects, repositories), between
the parts of one place (a repository's issues and its pull requests), into an item and back, and how the command
menu opens without a keyboard. The owner cannot judge this without seeing it, so the work is variants side by side.

The same layout will later be the inside of a hybrid phone app, so nothing here may rely on being in a browser
tab, beyond what is said under the constraints below.

## The user's task

"Let me check what is waiting for me, open it, and act on it — reply, reassign, move it in the project, close it —
with one hand, without hunting for where things are." And sometimes: "jot down a new issue before I forget it."

## What the first version does on a phone

- **My work**, with its groups (assigned to me, my pull requests, reviews waiting on me, mentioned) and counts.
- **A repository**: its issues and its pull requests, as lists.
- **A project**: its saved views, as lists. There is no board on a phone, and no list/board switch; a view saved as
  a board shows as a list grouped by the board's column field.
- **An item** (issue or pull request), full screen: read it, comment, change assignees, labels and project fields,
  open or close it. Its pull-request parts (checks, reviews) are shown, but merging is not done on a phone yet.
- **Creating an issue.**
- **The command menu**, opened by a button.
- **The first sign-in**: choosing what to track and the first download, both already full screens of their own;
  they only need to fit a phone.

Not on a phone yet: commits, code review (a pull request's changed files), Actions, merging, changing what you
track. A link to any of those opens the same address on github.com — the app already does that for every address
it does not show, so it is not a new screen to draw.

## Screens to draw

1. **The places.** Everything today's sidebar lists: My work and its groups, tracked projects, tracked repositories, each with its count, and the account (signed in as,
   sign out). Draft reviews and Broken workflows, which the desktop sidebar also lists, belong to code review and
   Actions, so not to the phone yet. This is the top of the navigation, and whether it is a screen, a menu or a drawer is one of the
   questions.
2. **A list screen**, in three kinds: My work (one of its groups), a repository's issues or pull requests, a
   project view. It answers: *what is here, and what needs me?*
3. **Moving between the parts of one place**: from a repository's issues to its pull requests; from one My work
   group to another; from one project view to another.
4. **An item**, opened from a list. It answers: *what is this, and what do I do about it?* Its comment box sits at
   the bottom of the screen, and while you type the phone's keyboard takes half the screen.
5. **Back from an item** to the same place in the same list.
6. **The command menu, open**, both over a list and over an item. Over an item it starts from that item, with its
   actions (assignees, labels, status, close…) first, then the repository's and the app's, and it can jump to any
   place. A phone has no hover and no keys, so the key hints the desktop shows have no meaning here.
7. **Creating an issue** from wherever you are.
8. **A link githq does not show on a phone**, followed from an item's timeline (a commit): it leaves for
   github.com. Whether the link says so before it is tapped is a question below.

## States

- **Fresh vs not.** On the computer a status bar along the bottom says how fresh the copy is and how much of the
  GitHub API allowance is left, and holds the edits still being sent. A phone has no room for a permanent bar, but
  "your edit did not go through" and "this is stale, githq cannot reach GitHub" must still be visible.
- **Nothing tracked yet**, and an empty My work group.
- **A long list**: dozens of tracked repositories, a project with hundreds of items.

## Technical constraints

- **No menu opens by swiping from an edge of the screen.** On the iPhone the browser takes edge swipes for its own
  back and forward, and the owner ruled it out. Every menu opens from something you tap.
- **Classic phone navigation** that makes good use of the top-left and top-right corners — the owner's direction.
- Everything opens instantly from the copy kept on the device, as on the computer: no spinner on navigation.
- Every screen has an address, and the address is GitHub's (`/owner/repo/issues/12`), so a shared link opens the
  same thing on github.com and in githq. Going back is the browser's back.
- The phone's own bottom edge (the home indicator) and the keyboard both take room from below.

## Questions this design should settle

Draw each as variants side by side, Variant A the one you recommend. These are starting points, not the limit: the
owner explicitly wants you to look for shapes nobody listed here, above all for the command menu's button.

- **A bar of tabs along the bottom.** The owner likes it for moving between the parts of a place, but it gets in
  the way when something else needs the bottom — above all the comment box — and it costs height.
  - What it holds: tabs that change with the screen (a repository's sections in a repository, My work's groups in
    My work, a project's views in a project), or fixed global tabs (My work, repositories, projects) with a
    repository's sections at the top of its screen.
  - Where it shows: on list screens only, or everywhere.
- **The left and right corners.**
  - One menu from the top-left that drills down: the places, then, after choosing a repository, its sections, with
    a way back up; opened inside a repository, it starts at that repository.
  - Or the left for places and the right for the screen you are on.
  - On an item's screen, the top-left: a back arrow instead of the menu, next to it, or the menu only.
- **The command menu's button.** Top-right is the obvious place; the middle of the bottom bar or a floating button
  are others. Look for something better.
- **Should a place show the parts a phone does not have?** A repository's Commits and Actions: hidden on a phone,
  or shown and leading to github.com, marked as such.

Two things any variant has to respect:

- The command menu is already the menu for the screen you are on: it starts from the opened item and its actions.
  A separate menu of the item's actions would hold the same things twice.
- A button on the bottom bar disappears wherever the bar does. If the bar is on list screens only, a button there
  is gone from the item's screen — where acting on the item matters most.

## Where to draw it

A new aspect frame, `App · Mobile`, with letters of its own (read the ones in use first, as the `design` skill says),
reusing Direction D's components and making phone variants of them where needed. The owner reviews by scanning the
amber `Variants · …` frames.
