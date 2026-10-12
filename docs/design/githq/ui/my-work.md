# Path: checking what's on my plate and acting on it

Read `README.md` in this folder first. This is the main path. It is the reason the app exists and what a
user does several times a day.

## Purpose

The user opens githq in the morning, or between two other things, to answer "what needs me right now?"
across all their repositories, and then to deal with some of it without leaving the keyboard. Today on
GitHub this means hopping between repositories and saved filters, and that is what the owner finds
uncomfortable.

## The user's task

"Show me everything that's mine or waiting on me, let me open any of it instantly, and let me do the small
things (reassign, relabel, close, reply, move in a project) in a keystroke or two."

## What happens, in order

1. **My work.** One view that gathers, from every repository:
   - issues assigned to me;
   - my open pull requests, with their status;
   - pull requests waiting for my review;
   - possibly also issues and PRs where I'm mentioned, or that I wrote.

   These come from anywhere on GitHub, including repositories the user doesn't track.
2. **Moving through it.** The user moves up and down with the keyboard, filters ("only this repo", "only
   failing PRs"), and sorts or groups. Everything responds instantly.
3. **Opening an item.** One key opens the selected issue or PR. It shows:
   - the title and body;
   - all its GitHub properties;
   - the projects it belongs to, with that project's fields (e.g. its Status in project A and a different
     Status in project B);
   - comments, linked PRs or issues, and sub-issues.
4. **Acting on it**, from the list or from the opened item:
   - change assignees, labels or milestone;
   - close or reopen;
   - set a project field (e.g. Status, Iteration);
   - write a comment;
   - for a PR, open it on github.com to review code.

   Each change shows at once.
5. **Back to the list**, with the selection and scroll position preserved, and on to the next item.
6. **Jumping anywhere.** A command palette finds any item by title or number, any repository or project, and
   any action.

## What matters

- **The list.** The question is: "which of these needs me, and which can wait?" In order of importance:
  - what kind of thing it is and why it's here (assigned, my PR, review requested);
  - the title;
  - for PRs, the status (checks failing, changes requested, approved and mergeable, conflicts), because
    that decides whether the user has to act;
  - the repository;
  - how recently it changed;
  - then everything else (labels, assignees, comment count, project fields).
- **An opened item.** The question is: "what is this, and what's its state?" The body and the latest
  activity matter more than the full history.
- **A PR's status** is the most decision-relevant thing in this path. "Checks failing" and "approved, ready
  to merge" mean opposite things for the user's next minute.

## States

- **Nothing on my plate.** It's a good state, not an error.
- **Still downloading** on the first sign-in: the parts that already arrived are usable.
- **An edit was rejected by GitHub,** e.g. no permission to label in someone else's repository. The change
  is undone and the user sees why. **This must be visible**, because otherwise the user believes the edit
  went through.
- **Refresh paused** because the hourly API allowance ran out. Data and edits still work, and other people's
  changes are delayed. It should be visible but calm.
- **Read-only items.** In someone else's open-source repository the user can comment but often can't change
  labels or assignees. The available actions differ per item.
- **An item from an untracked repository.** It appears here because it concerns me, but its repository isn't
  copied in full, so jumping to "the rest of this repo" isn't available until it's tracked.

## Questions this design should settle

- **A PR that closes an issue.** If I'm assigned issue #12 and opened PR #15 that closes it, is that one row
  or two? Two rows are faithful to GitHub but show the same work twice. One row (the PR under the issue,
  Linear-style) is quieter, but then the issue row carries the PR's status, and a PR closing three issues
  appears three times. This is deliberately left open. The owner wants to decide after seeing it drawn.
- Is "my work" one list with groups, several lists, or something else? Which groups earn a place by default?
- Does an opened item replace the list, sit beside it, or float over it? What does that mean for moving to
  the next item without closing?
- How does the user discover single-key actions without a cluttered screen?
