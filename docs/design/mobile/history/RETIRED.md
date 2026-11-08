# Retired decisions

Decisions no longer in force, with what replaced them.

## D10

**The bottom bar shows on list screens only. On an item's screen the bottom belongs to the comment box.**
(2026-11-06, owner, picked from the drawings: `MB23` in `githq.pen`)

Replaced the same day by [D17](../DECISIONS.md#d17): there is no bottom bar at all. The comment box keeps the bottom of
an item's screen.

Rejected at the time: the bar everywhere with the comment box above it (MB24), and everywhere with the comment box
behind a button (MB25).

## D4

Retired in part 2026-11-08: tracking settings moved into the first version by [D30](../DECISIONS.md#d30).

**The first mobile version is the daily loop: My work, a repository's issues and pull requests, a project as a
list, an item read and edited (comment, assignees, labels, project fields, open or closed), a new issue, the
command menu from a button, and the first sign-in ([D7](#d7)). Commits, code review, Actions, tracking settings and merging come later.**
(2026-11-06, proposal of the design agent; the owner confirmed merging as later and raised no objection to the
rest)

**Why.** The owner asked for the basic functionality first, naming commits and code review as later, and put
merging later too. The rest of the list is inferred from the desktop's first version, not from the owner.

**Rejected.**

- Merging a green pull request from the phone in the first version — the owner put it later; on the desktop it is a
  whole panel of conditions, checks and stacks.

## D7

Retired in part 2026-11-08: the first download's screen no longer exists ([first-run design](../../first-run-and-loading/README.md)), and changing tracking in Settings is on a phone by [D30](../DECISIONS.md#d30).

**The first sign-in works on a phone: choosing what to track and the first download are part of the first mobile
version. Changing tracking later, in settings, is not.** (2026-11-06, owner, on the design agent's proposal)

**Why.** GitHub has no such screens, so the hand-off of [D3](#d3) cannot cover them, and someone signing in for the
first time from a phone would otherwise be stuck. Both are already full-width screens of their own, outside the
shell's side-by-side panes (`firstSignIn` routes, `packages/app/app/router.options.ts`), so fitting them to a
phone is cheap.

**Rejected.**

- Accepting the default choice (your own repositories) without asking on a phone — a member of an organization,
  whose repositories are not "theirs", would land in an empty My work with no way to fix it from the phone.

## D22

Retired 2026-11-08, replaced by [D30](../DECISIONS.md#d30): tracking is in Settings on a phone too.

**githq's own Settings works on a phone, all but its tracking section: the sections that make sense on a phone
(display, where settings are saved) fit the narrow screen, and the repositories-and-projects section is not offered
there.** (2026-11-08, owner, on the design agent's proposal)

**Why.** Settings has a GitHub-reserved address (`/settings`) that on github.com is GitHub's own account settings, so
the hand-off of [D3](#d3) would land somewhere else entirely. Settings is one column of sections, so fitting it is
cheaper than an exception to the hand-off. Tracking stays off the phone as [D4](#d4) says; the first sign-in's choice
is the exception ([D7](#d7)).

> **Checked 2026-11-08:** the sections are repositories (tracking, the default one), display, saving, code review,
> and the desktop app's updates and changelog — `packages/app/settings/settingsRoutes.ts:24`.

**Rejected.**

- No Settings on a phone, `/settings` showing "open it on a computer" — an exception to the hand-off rule, to save
  fitting a simple page.
