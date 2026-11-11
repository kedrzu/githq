# Shaping a list and creating an issue, on a phone

The brief for the last screens of githq's first phone version. The product, its data and Direction D are in
[the app's brief](../../githq/ui/README.md). The same things on the computer are in
[working inside a project or a repository](../../githq/ui/project.md) and [creating an issue](../../githq/ui/new-issue.md)
— read both; this file only says what is different on a phone. The rules for the design file are in the `design` skill.

## Purpose

Two gaps are left in the phone's first version. A list's options button sits in the top-right corner, but nothing yet
shows what it opens. And the new issue form is drawn only as its screen with the keyboard up: how its repository and
its details are chosen is not. Both are about doing on a phone what the computer does with a keyboard and a wide toolbar.

## What is already settled, and drawn in `App · Mobile`

Build on it; don't redraw it as variants.

- **No bottom tab bar.** A command line floats over the bottom of every screen; on a list it is one wide button with ⌘
  and a chip naming the part you are in — a repository's section, My work's group, a project's saved view — with its
  count. Tapping it opens the command menu with the place's parts nearest the thumb.
- **The command menu rises from below**, input at the bottom, no keyboard until the input is tapped. Changing a
  property — on an item, or on a row swiped to the left — opens it straight at that property's choices.
- **The ⌘ button leaves inside a task** — creating an issue is one — and comes back at rest.
- **Top-right on a list:** the list's options (filter, sort, group) and New issue.
- **An item's properties**: the ones that need their name are rows under the title, the rest are chips; tapping one
  opens its choices.
- **No board on a phone, and no switch between list and board.** A project view saved as a board shows as a list grouped
  by the board's column field.
- **Several items can be selected**, from the list's options.
- No edge swipes open anything.

## The user's task

"Show me this list the way I need it right now — only mine, by priority, grouped by status." And: "write this down
before I forget it, in the right repository, and get back."

## Screens, in order

1. **A list's options.** Filter, sort and group, for each kind of list: a repository's issues or pull requests (grouping
   by milestone — the default — assignee, author, status, label, issue type), a project view (grouping and sorting by
   the project's own fields), My work (by reason, repository, status, author).
2. **A project view changed on this device.** Changing grouping, sort or filter in githq is saved on this device only
   and never written to GitHub, because the view is shared with the team. The view must show it is modified locally,
   with a way back to GitHub's version.
3. **A project view saved as a board, shown as a grouped list**: the board's columns become groups, in their order,
   each with its count, the empty ones included or not. A column holding a hundred items next to columns holding three.
4. **A project with no single-choice field**, so nothing to group a board by.
5. **Starting a new issue** from each place — and what it starts with: in a project, that project (and from inside a
   group, that group's value); in a repository, that repository; from an open issue, the offer to make it a sub-issue;
   from My work, the repository used last.
6. **Choosing the repository**: required. Tracked ones first, but any repository the user can create issues in is
   allowed, found by typing.
7. **Title, then optional details**: body (markdown), assignees with "assign to me" one tap away, labels, milestone,
   issue type, parent issue, projects and their fields. The details come from the chosen repository, so changing the
   repository may drop labels that do not exist there.
8. **An issue template.** Many repositories define them on GitHub; contributing to someone else's project often
   requires one. A structured form may be shown as a pre-filled markdown body in the first version.
9. **Created**: the issue appears at once where it belongs, GitHub gives it its number a moment later, the user is
   back where they were. "Create another" for several in a row.
10. **A draft issue written straight into a project**, which the computer can do.

## States

- **No permission to create issues** in the chosen repository, or issues turned off there: said before anything is
  written, not after.
- **Creation rejected by GitHub** after the user wrote the issue: the text is kept and the reason shown. **Must be
  visible, and must not lose the text.**
- **An empty project, and an empty saved view.**
- **A view whose filter githq cannot evaluate yet**, answered by GitHub instead, which takes a moment: the user sees that
  this view is slower and why. Rare.

## Technical constraints

- A view's local changes live on this device; the same project on the computer may show it differently.
- What may be set on a new issue depends on the user's permissions in that repository.
- The issue's number comes from GitHub after it is created; until then it has none.

## Questions this design should settle

Draw each as variants side by side, Variant A the one you recommend, as the `design` skill says, and propose others where you
see them.

- **What the options button opens**: a sheet rising from below like the command menu, with filter, sort and group
  together, against the command menu itself opened at a "View" step, against a screen of its own.
- **Where "modified locally" and the way back to GitHub's version show**: on the command line's chip, in a strip under
  the top bar, or only inside the options.
- **A grouped list on a phone**: groups that collapse, against a jump between groups, against plain headers — with one
  group of a hundred items among small ones.
- **The new issue's repository**: chosen first, before the title, against defaulted from the place and changed from a
  chip in the form.
- **The new issue's details**: the same rows and chips as on an item, against a single "Add details" that opens them,
  against only through ⌘ after the title.

## Where to draw it

In `App · Mobile`, the next MB codes, reusing its components and Direction D's.
