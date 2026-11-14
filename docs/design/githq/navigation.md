# Navigation

How a user moves between a list, an item and what lies inside an item, by keyboard and by Back. Every screen
follows it, so a key does the same thing everywhere. The arrangement itself (panel, full page, their widths) is
[D9](DECISIONS.md#d9); this is how you move through it.

## Levels

A screen is a stack of levels, entered one at a time:

1. **A list:** My work, a project, a repository's tab, the Workflows section.
2. **An item, in the panel** beside the list it was opened from.
3. **The item full screen:** its page, the same item view.
4. **Something inside the item that has a page of its own:** a pull request's review, a workflow's run, a run's job
   log. It is always a full page.

An item is anything opened from a list: an issue, a pull request, a workflow.

## Keys

- **`↵` goes one level in.** On a row of a list, it opens the row's item in the panel. On the row already open in the
  panel, it opens the item full screen. On a row inside an item full screen (a run in a workflow), it opens that
  row's page.
- **`⇧↵` on a list opens the selected row's item straight full screen,** skipping the panel. With an item open in the
  panel, `⇧↵` switches it between the panel and full screen.
- **`Esc` goes one level out, back the way you came:**
  - from a page inside an item (a run), to the item, in the arrangement it was in (panel or full screen);
  - from an item full screen that was expanded from the panel, to the panel;
  - from an item full screen opened straight from the list (`⇧↵`) or from elsewhere (a link, ⌘K), to the list;
  - from the panel, closes it; the row stays selected.
- **Before it navigates, `Esc` closes what is on top:** an open menu, picker or search first, then a focused field
  (with its edit kept), then a selection of several rows or an active filter, and only then a level.
- **`j`/`k` move to the next or previous row** of whatever has the keyboard. Key caps show the letter in capitals (`J`
  `K`); a capital is drawn as `⇧J`.
- **In the panel the list keeps the keyboard:** `j`/`k` move the list and the panel follows the selection.
- **Full screen, `j`/`k` step to the next or previous item** of the list it was opened from, without going back to
  it.
- **An item whose content is a list of its own** (a workflow's runs) gives `j`/`k` to that list full screen, and steps
  to the next or previous item with `⇧J`/`⇧K` instead. Its stepper in the header shows `⇧K` `⇧J`.
- **A page whose content has rows of its own** (a run's log: lines, steps, jobs) gives `j`/`k` to those rows; it has no
  list of siblings to step through.

## Back and addresses

- **Every level has its own address**, GitHub's where GitHub has one, so a link opens the same thing and a reload
  keeps it: the panel as a query on the list's address, a full page as its own route.
- **Back retraces what `Esc` does.** Opening a level pushes a history entry; moving the cursor or stepping with `j`/`k`
  replaces it, so Back never walks through every row looked at.
- **A level reached from outside the app** (a deep link, a fresh tab) has no history to return to; its `Esc` goes to
  the level above it (an item to its list, a run to its workflow), not out of the app.

## Starting things

A single key never starts a workflow on GitHub: a re-run, a dispatch or a cancel goes through the command menu or an
explicit button ([actions D10](../actions/DECISIONS.md#d10), [D15](../actions/DECISIONS.md#d15)).
