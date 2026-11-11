---
name: design
description: >-
    githq's design in Pen: `githq.pen`, its layout, screen codes, Direction D and the brand, the design logs. Use
    before changing githq.pen, starting a design round, building from a design log or resolving a githq.pen merge
    conflict, and when an implementation has to differ from the design (a contrast or axe failure, a missing state).
---

# Design

Why githq designs in Pen, and how the file merges: `ARCHITECTURE.md#tooling-and-workflow`. What the product is, for a
brief: `docs/design/githq/ui/README.md`.

## Paths

- **The file:** `githq.pen` at the repo root. Each worktree has its own copy.
- **One top-level frame per aspect.** A new screen goes into its aspect's frame; a new aspect gets a new frame:
  - `App · …`: the app, one frame per aspect (My work, project, repository, pull request, merging, stacks,
    workflows, settings, the menus, first sign-in, states, freshness, mobile and more);
  - `Desktop · …`: screens only the desktop app has;
  - `Landing — …` and `Landing · …`: the landing page, desktop and mobile, its motion storyboard, the download page;
  - `Docs · …`: the documentation site;
  - the brand: `Logo — git/hq`, app icons, OpenGraph images.
- **`App · Overview — Direction D`** (`I7akNj`): the chosen direction at a glance.
- **Shared components:** `App · Components` (`pUvet`): atoms (keys, avatar, labels, status, buttons, hints, chips,
  tabs), the sidebar, item sections, list rows (`List row / …`, `Table row / …`), list and group headers, project
  parts, whole panes (`List pane / …`, `Project pane / …`). Components of one aspect sit in a `Components · …` frame
  at the top of that aspect's frame.
- **Design logs:** `docs/design/githq/changelog/<feature>.md`. Logs from before this flow start with a
  `Document: <path>` line naming a worktree's copy; they are history, not the format.
- **Briefs:** `docs/design/<slug>/ui/`, one file per thing a user does.

## Naming

- **A screen's code is its aspect's letters and a number** (`PM12`, `W4`): `PM` merging, `W` workflows, `T`
  settings. Read the letters off the aspect's frame before adding a screen; a new aspect takes letters no other
  aspect in the file uses.
- **Codes already in the file stay as they are,** letter suffixes (`K1b`, `PM24b`) included. New screens add none.
- **A screen sits in a slot:** `Slot · W2 · Everything broken`, with the caption `W2 · Everything broken` and the
  screen frame named the same. A question's amber goes on its slot.

## Direction and brand

- **Direction D** is settled: one app with three independent switches — the sidebar expanded or collapsed to a rail;
  every list as List or Board with the same toolbar; an item in a panel, a modal or a full page, all three showing the
  same item view. Build on it and keep its components and feel. The rejected Directions A–C are in git history.
- **The logo is settled.** The brandbook is the frame `Logo — git/hq` (`S5J7kt`): the wordmark `git/hq` and the
  sygnet `/hq`, in Geist 700, black or white only, with violet (`$accent`) on the slash alone. One of them in a given
  place, never both side by side, placed through `Brand / Wordmark` and `Brand / Sygnet`. Don't change it.

## Decisions

- **Design decisions go in the design's `DECISIONS.md` and `JOURNAL.md`** (`docs/design/githq/` for the app as a
  whole, `docs/design/<slug>/` for a feature). The log records what changed in the file; it doesn't replace them.

## The design follows the implementation, here

- **Tokens:** `packages/app/styles/tokens.scss` is the code's side of the file's variables, named without the
  `color-` prefix (`$color-fg-3` ↔ `$fg-3`). A token changed to pass contrast is changed in the file's variable in
  the same PR: a small change. A token whose change visibly alters many screens is a big one.
- **Accessibility failures come from** axe in the Storybook component tests (`bun run test:stories`), the e2e checks
  in `packages/e2e/src/accessibility/`, and `packages/app/styles/tokens.test.ts` for the contrast axe doesn't measure
  (icons, outlines, graph lines). A log round made during implementation names the failing story or test.

If the practice document isn't inlined below, read `nzyme/docs/practice/design.md` before changing the design.

Links in the document below are relative to `nzyme/docs/practice/`; package READMEs are `nzyme/packages/<pkg>/README.md`.

!`cat nzyme/docs/practice/design.md`
