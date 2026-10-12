# Path: working inside a project

Read `README.md` in this folder first.

## Purpose

The user maintains something planned in a GitHub Project: a release, a roadmap, the backlog of an
open-source library. They come here to see the state of the whole thing and move work along, not just
their own part. This is where githq replaces the GitHub Projects screens.

## The user's task

"Show me this project the way I think about it (by status, by iteration, by whoever is on it), let me
triage and move things quickly, and don't make me wait."

## What happens, in order

1. **Choosing a project.** The user picks one of their tracked projects, from navigation or the command
   palette.
2. **Seeing its items.** Items come from several repositories: issues, PRs and draft issues. Each item
   shows the fields **this project defines**. Since fields differ between projects, the view must adapt
   to whatever fields exist. One project has Status, Priority and Iteration. Another has only a text field
   called "Area". A third has nothing beyond GitHub's built-ins.
3. **Shaping the view.** The user filters (e.g. "Iteration = current", "assigned to me", "label: bug"),
   groups by a field (e.g. by Status), and sorts. The project on GitHub may already have saved views like
   this, defined by its maintainers. Reusing them would be faithful, but nothing here assumes we can.
4. **Triage and moving work.** For the selected item, the user changes any project field (move to In
   Progress, set the iteration, set priority), assigns people, adds labels, and closes. Several items can be
   selected and changed at once. Draft issues can be written straight into the project.
5. **Opening an item** works the same as in [checking what's on my plate](my-work.md), and the user comes
   back to the same place in the project.

## What matters

- **The project view.** The question is: "where does the work stand?" That usually means how many items
  are in each value of the main field, and which are stuck or unassigned. Which field is "main" is the
  project's choice, not ours. It might be Status, or it might not exist.
- **An item row.** It shows the title, its repository (projects mix repositories), the project's fields,
  assignees, and for PRs their status.
- **Iterations** have dates. "Current", "next" and "past" are meaningful to the user.

## States

- **A project with no single-choice field at all.** Grouping by status is impossible, so the view must still
  make sense.
- **A large project** with thousands of items and many closed ones. Showing open items by default may
  matter.
- **An item from a repository the user can't edit.** Its project fields are editable, because they belong
  to the project, but its labels and assignees may not be.
- **Someone else is moving things on github.com at the same time.** Their changes appear within about a
  minute, and items may shift under the user's selection.
- **An edit rejected by GitHub:** the change is undone and the reason is shown. **This must be visible.**
- **An empty project.**

## Questions this design should settle

- **List, board, or both in the first version?** GitHub Projects offers both a table and a board grouped by
  a field. A list with grouping might be enough to start. The owner wants to see it drawn before deciding.
- How does a view adapt to arbitrary fields without looking like a spreadsheet?
- How are a project's fields edited from the keyboard when there can be five fields of different types?
- Is the project view a different place from "my work", or the same kind of list with different
  contents?
