# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone, so
`DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes from
reviews live in [history/](history/). Navigation ideas not yet chosen are in [variants.md](variants.md), waiting to be
drawn.

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is not.

## D1

**The navigation is classic mobile navigation and makes good use of the top-left and top-right corners; its exact
shape is picked from drawn variants, not argued.** (2026-11-06, owner)

**Why.** The owner cannot judge the bottom bar or the menus without seeing them, so every idea goes to the design
agent to be drawn side by side ([variants.md](variants.md)), and the design agent is free to propose shapes nobody
listed.

## D2

**No menu opens by swiping from a screen edge — every menu opens from a button.** (2026-11-06, owner)

**Why.** A swipe from the edge is risky, the iPhone above all, where the browser takes edge swipes for its own
gestures; the owner rules it out for now.

**Rejected.**
- Swiping from the left edge to open the left menu — clashes with the browser's own edge gestures.

## D3

**On a phone, an address githq does not show there is handed off to github.com, the same way as every address
githq does not show at all.** (2026-11-06, owner)

**Why.** It is the rule the app already lives by, so nothing new is invented for mobile: the set of addresses githq
shows is simply smaller on a phone. Commits and a pull request's review (`/pull/:n/files`) are the first such
addresses.

> **Checked 2026-11-06:** the hand-off replaces the githq entry in history with the same path, query and fragment on
> github.com, so going back does not land on it again; the desktop app opens github.com in the system browser and
> goes back instead — `packages/app/shell/GitHubHandOffPage.vue:1`.

**Rejected.**
- A "not on mobile yet" screen with a link to GitHub — a dead end, and a second way of saying what the hand-off
  already says.
- Redirecting to the nearest screen githq has (a pull request's files → the pull request) — the link would not show
  what it promised.

## D4

**The first mobile version is the daily loop: My work, a repository's issues and pull requests, a project as a
list, an item read and edited (comment, assignees, labels, project fields, open or closed), a new issue, and the
command menu from a button. Commits, code review, Actions, tracking settings and merging come later.**
(2026-11-06, proposal of the design agent; the owner raised no objection but has not confirmed the list)

**Why.** The owner asked for the basic functionality first, naming commits and code review as later. The rest of
the list is inferred from the desktop's first version, not from the owner; merging is the open edge.
