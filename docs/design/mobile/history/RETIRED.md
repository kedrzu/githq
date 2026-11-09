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

## D41

Retired 2026-11-09, replaced by [D9](../DECISIONS.md#d9): its premise was wrong — the desktop does read a saved view's layout from GitHub, board included (`packages/app/projects/projectViewOptions.ts:62`).

**A phone shows no board, and a project view's layout saved on GitHub does not reach it: view preferences are not
synced with GitHub, so there is no board view to turn into a grouped list. A project's list is grouped as set on this
device (D36, D37).** (2026-11-08, owner: view preferences aren't synced with GitHub, so the case does not happen; the
question `MB185`–`MB190` was dropped)

**Why.** The owner: there is no board view on a phone, and the board saved on GitHub never arrives as one.

> **Not settled by this:** [D9](#d9) and the README still say a view saved as a board shows as a list grouped by its
> column field; that sentence is superseded here.

**Rejected.**

- Groups that fold with a pinned header (MB185–MB187), a strip of groups (MB188), plain headers (MB189), a long group
  showing its first three (MB190) — all answered a case that does not happen.

## D9

Sharpened 2026-11-09 (boards out of the phone entirely); the rule for a board view saved on GitHub, struck by D41, restored.

**No board on a phone in the first version: lists only, and the switch between list and board is not shown. A
project view saved as a board shows on a phone as a list grouped by the board's column field.**
(2026-11-06, owner said to leave the board for now; how a board view shows is the design agent's proposal)

**Why.** The owner set the board aside. A board's columns are the values of the field it groups by, so a list
grouped by that field holds the same items in the same order of groups, and the view stays usable.

## D38

Retired 2026-11-09, replaced by [D43](../DECISIONS.md#d43): its reason, "as on the desktop", was wrong.

**A new issue's repository is chosen first: New issue opens on the repository step, keyboard up, the place's repository
at its top, Draft issue leading in a project, a repository that takes no issues dimmed with the reason; the title comes
after.** (2026-11-08, owner: as on the desktop; `MB193`)

**Why.** The owner: it is the same on the computer. Saying a repository won't take issues before anything is written
falls out of it, in the list itself.

**Rejected.**

- Filled in from the place and changed from its row in the form (MB191–MB192) — the design agent's recommendation.

## D40

Retired 2026-11-09, replaced by [D44](../DECISIONS.md#d44): the desktop had no such toast; the owner made the toast a change for both.

**Create always closes the form. The toast that follows is the computer's toast on a phone — a title saying what was
created, a detail line, a countdown, and real buttons: Create another, which opens the form again with the same
repository, project and labels, and Open.** (2026-11-08, owner: the toast, but its action must clearly be a button with
a verb, the toast larger and like the other toasts; drawn in `MB204`, `MB215`, `MB217`)

**Why.** The owner picked the toast over a switch in the form, and asked that the action read as a button.

**Rejected.**

- A Create another switch in the form (MB202–MB203) — the design agent's recommendation.
- A one-line toast with a bold word as its action — not visibly a button.

## D26

Retired 2026-11-09, replaced by [D45](../DECISIONS.md#d45): its reason misdescribed the desktop's picker, which has search.

**A property is changed both by tapping it on the item, which opens the command menu straight at its step, and through
⌘ from the item. Every property row shows › to say it can be tapped; the state pill opens closing or reopening.**
(2026-11-08, owner, on the drawings `MB108`–`MB112`)

**Why.** The owner: for a good affordance a property should be changed where it is seen, and the command menu stays
the place where everything is. Both are the same sheet, so there is one mechanism to learn.

**Rejected.**

- A picker of its own dropping from the property (MB111) — a second kind of menu, covering the item, without search.
- Changing only through ⌘ (alone) — a value you can see but not touch.

## D27

Changed in part 2026-11-09: the actions open the property's menu at the bottom ([D45](../DECISIONS.md#d45)), not the command menu.

**Swiping a list row to the left reveals Status, Assign and Close; each opens the same step of the command menu as on
the item. Everything stays reachable by opening the item.** (2026-11-08, owner, picked from the drawings: `MB114`)

**Why.** The owner: a great idea. Swiping a row is not an edge swipe ([D2](#d2)), and it makes triage from the list
fast.

> **Not settled by this:** which three actions a pull request's row reveals; the drawing shows an issue's.

**Rejected.**

- A long press opening the command menu at the row (MB113) — the design agent's recommendation.
- Nothing, open the item first (MB115).

## D42

Changed in part 2026-11-09: tapping a detail opens its menu at the bottom ([D45](../DECISIONS.md#d45)), not the command menu.

**A new issue's details are set as on an item: under the title the rows that need their name — Assignees with Assign
to me at its end, the project's field when there is one, the parent — then the rest as chips, empty ones saying what
they would hold; tapping any of them opens the command menu at its step.** (2026-11-08, owner, picked from the drawings:
`MB194`–`MB196`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the form reads like the item it becomes
([D25](#d25)), changed the same way ([D26](#d26)), and assigning yourself is one tap.

**Rejected.**

- One Add details row (MB197), only through ⌘ (MB198), icons above the keyboard (MB199, what MB67 showed until now).

## D36

Changed in part 2026-11-09: filtering by field values is drawn but not built in the first version ([D46](../DECISIONS.md#d46)).

**A list's options button opens one sheet rising from below with the list's filter, grouping and sort together, each a
row of chips changed in place while the list behind follows; a field's values are picked in the command menu's step.
A repository offers GitHub's own groupings (milestone first), a project its fields first, My work reason, repository,
status and author.** (2026-11-08, owner, picked from the drawings: `MB173`–`MB176`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: one tap per change, every setting in view, and
the sheet opens the same way as the command menu.

**Rejected.**

- The command menu opened at a View step (MB177–MB178) — every change two taps, one setting in view at a time.
- A screen of its own (MB179) — the list it changes is out of sight.

## D20

Changed in part 2026-11-09: the same rule now holds on the computer too, which went to My work.

**On an item's screen the top-left corner is a back arrow with the name of the list it returns to. Opened from a link,
with no list behind it, the arrow goes up to the repository and says so.** (2026-11-08, owner, picked from the
drawings: `MB35`, with `MB62`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: it says what you return to, and the places are
two taps away when wanted, back and the panel, or the command menu's Go to.

**Rejected.**

- Back with the menu beside it (MB36) — two controls fight for the corner, and the wrong tap throws you out of the
  item.
- The menu only, back left to the browser (MB37) — an installed hybrid app has no browser back.

## D23

Changed in part 2026-11-09: the filters follow the computer's order and default.

**My work's filters (Needs me, Waiting on others, All, each with its count) sit in a strip under the top bar. A row at
a phone's width keeps the type, the title on up to two lines, the repository without its owner when it is tracked
(with it when not), the project's row field with +N, labels as colour dots, one avatar, and for a pull request its
checks and review state, or Draft.** (2026-11-08, owner, picked from the drawings: `MB89`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the filter is the first choice on every visit,
and behind the corner menu nobody would see which one is on; the desktop row's labels, milestone and assignee names
do not fit in about 350 px, and they are one tap away in the item.

## D37

Retired 2026-11-09, replaced by [D49](../DECISIONS.md#d49): a project view does come from GitHub, so a change made in githq has a GitHub version to differ from.

**A view changed on a phone stays this device's own: it is not saved in the synced settings, it carries no mark, and
there is no way back to GitHub's version to offer.** (2026-11-08, owner: view preferences are not in synced settings, so
there is no need for "back to GitHub"; the question `MB180`–`MB184` was dropped)

**Why.** The owner did not see what the mark and the reset were for: nothing about a view's shape leaves the device.

> **Not settled by this:** the computer's project brief still asks for a locally modified tab with a reset
> (`docs/design/githq/ui/project.md`); whether the computer drops it too is the owner's call there.

**Rejected.**

- A dot on the command line's chip with Back to GitHub's view in the options (MB180–MB182), a strip under the top bar
  (MB183), the reset only inside the options (MB184).

## D43

Changed 2026-11-09 the same day: outside a repository nothing is chosen in advance, on both platforms.

**A new issue starts in the repository of the place: in a repository, or on an item, that repository, shown in the
form and changed from it. Started from outside any repository — My work, a project, anywhere else — it opens on choosing
the repository first.** (2026-11-09, owner: as on the desktop, with the exception that outside a repository the
repository is chosen)

**Why.** The owner wants the desktop's behaviour, which fills the repository in from the place.

> **Checked 2026-11-09:** the desktop fills in the screen's repository, and elsewhere the last draft's or the last used
> one; the chooser opens first only when there is none — `packages/app/newIssue/NewIssueComposer.ts:193-215`,
> `packages/app/newIssue/NewIssueDialog.vue:141`. So "outside a repository, choose first" is not yet what the desktop
> code does from My work: it offers the last used repository.

**Rejected.**

- The repository always chosen first ([history](history/RETIRED.md#d38)) — chosen as "as on the desktop", which it is
  not.
