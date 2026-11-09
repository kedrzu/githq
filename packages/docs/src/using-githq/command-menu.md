# The command menu

The command menu finds any action, place, issue or pull request in githq, and runs it. Open it anywhere with
<kbd>⌘</kbd> <kbd>K</kbd> on macOS, or <kbd>Ctrl</kbd> <kbd>K</kbd> on Windows and Linux.

## Open it

Press <kbd>⌘</kbd> <kbd>K</kbd>, or click **Search or jump to…** at the top of the sidebar. Press it again, or
<kbd>Esc</kbd>, to close it.

In a comment box or another field where you write text, <kbd>⌘</kbd> <kbd>K</kbd> belongs to the field. Leave the field
first.

## What's at the top

Before you type, the menu lists what you can do here, under these headings:

- **What you're on.** The opened item, or the items you selected together. A chip at the left of the field names it,
  such as `portal#1187` or `3 items`, and its actions come first: assign, label, set a status, close and more, each with
  its current value and its key.
- **This view**: the actions of the screen, such as its filters, its layout or **Group by…**.
- **The repository**, under its name, on any screen that belongs to one: its sections, **Open on GitHub**, **Copy link**,
  **Repository settings**, and **Track repository** while you don't track it.
- **Go to**: My work and each of its groups, **Draft reviews** while you have any, **Broken workflows** and **Settings**.
- **Projects** and **Repositories**: the ones you track.
- **App**: **New issue**, **Keyboard shortcuts**, **Search repositories…** and the like.

With the field empty, <kbd>⌫</kbd> takes out the chip, so the menu stops acting on that item. The repository's chip goes
next.

## Search

Type to find actions, places, projects, repositories and items, best match first. The menu searches what is on your
device, so results are instant and ask nothing of GitHub. It also finds what lies deeper: typing `in prog` offers
**Set status → In progress** directly.

- **Issues and pull requests** by title, or by number: `#123`, `portal#123` or `acme/portal#123`. Typing `#123` alone
  finds items only. The menu lists up to eight.
- **A repository you don't track**: type `owner/name`, and the menu offers to open it.
- **Any repository on GitHub**: choose **Search repositories…**. This one asks GitHub as you type, at least two
  characters; `org:` and `stars:` work as on GitHub.
- **Actions only**: start with `>`, and places and items are left out.

The menu finds only issues and pull requests githq has on your device: what concerns you, and everything in what you
track. See [Choose what to track](../getting-started/choose-what-to-track.md#tracked-and-not-tracked).

An item you choose opens as it would from a list: over the screen, or on its own page.

## Levels and pickers

Some lines hold more. **Settings** holds its sections, a project its saved views and actions, a repository its sections
and actions. An action such as **Assign to…** or **Set status…** holds a picker of its values.

|Key|What it does|
|-|-|
|<kbd>↑</kbd> / <kbd>↓</kbd>|Move|
|<kbd>Enter</kbd>|Run the action, or open its picker or level|
|<kbd>Tab</kbd> or <kbd>→</kbd>|Enter the line's level or picker|
|<kbd>←</kbd> or <kbd>⌫</kbd>|Step back a level, with the field empty|
|<kbd>Esc</kbd>|Step back a level, or close|

In a picker, the current values are checked. A value only some of the selected items have is marked half, and picking
it gives it to all of them. Typing filters the options.

## Keyboard help

Press <kbd>?</kbd> for **Keyboard shortcuts**: every action that has a key and can run where you are, under **Selected
items**, **Opened item**, **This view**, **This repository** and **Anywhere**. It lists only the keys that work at that
moment. The code review has a sheet of its own, **Keys in a review**.

The command menu teaches keys too: an action's key shows at the end of its line, and in the menus you open by
right-clicking a row.

## Keys that work everywhere

|Key|What it does|
|-|-|
|<kbd>⌘</kbd> <kbd>K</kbd>|Open the command menu|
|<kbd>?</kbd>|Keyboard shortcuts|
|<kbd>C</kbd>|New issue, in the repository or project you are in|
|<kbd>,</kbd>|Settings|
|<kbd>[</kbd>|Collapse or expand the sidebar|

Letter keys work without <kbd>Shift</kbd> unless <kbd>Shift</kbd> is shown. Single keys don't act while you type in a
field.

The keys of lists, items and reviews are on the pages about them: [My work](./my-work.md#act-from-the-list),
[Repositories](./repositories.md#commits) and [Pull requests and reviews](./pull-requests-and-reviews.md).
