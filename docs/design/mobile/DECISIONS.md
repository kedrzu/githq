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
list, an item read and edited (comment, assignees, labels, project fields, open or closed), a new issue, the
command menu from a button, and the first sign-in ([D7](#d7)). Commits, code review, Actions, tracking settings and merging come later.**
(2026-11-06, proposal of the design agent; the owner confirmed merging as later and raised no objection to the
rest)

**Why.** The owner asked for the basic functionality first, naming commits and code review as later, and put
merging later too. The rest of the list is inferred from the desktop's first version, not from the owner.

**Rejected.**

- Merging a green pull request from the phone in the first version — the owner put it later; on the desktop it is a
  whole panel of conditions, checks and stacks.

## D5

**"On a phone" means a narrow window: below one width the app takes its mobile layout and the hand-offs of
[D3](#d3), whatever the device. Resizing never navigates — whether an address is handed off is decided when it is
navigated to, and a screen already open stays and is squeezed.** (2026-11-06, owner, on the design agent's proposal)

**Why.** A narrow window needs the mobile layout anyway: the desktop's side-by-side panes do not fit below about
650 px. If the feature set followed the device instead, a narrow window on a computer would need mobile versions of
commits and code review, which are not designed. The width is not fixed here.

> **Checked 2026-11-06:** the shell's screen has a minimum width of 400 px and the sidebar of 180 px —
> `packages/app/shell/AppShell.vue:85`, `:88`. The landing page already switches to its mobile layout below 720 px
> of its container — `packages/app/styles/tokens.scss:241`.

**Rejected.**

- Deciding by device (a touch screen and a narrow screen) — a narrow window on a computer would be a third state,
  mobile layout with desktop features, that nobody designs. It would win if someone regularly works in a narrow
  window on a computer and needs commits there; no such case is known.
- Handing off on resize — narrowing a window during a code review would throw the user out to github.com.

## D6

**The desktop app never takes the mobile layout: its window has a minimum width above the mobile width.**
(2026-11-06, proposal of the design agent, not confirmed by the owner)

**Why.** Nobody runs the desktop app on a phone, and a narrow desktop window handing commits off to the browser
would take away what the desktop app is for.

## D7

**The first sign-in works on a phone: choosing what to track and the first download are part of the first mobile
version. Changing tracking later, in settings, is not.** (2026-11-06, owner, on the design agent's proposal)

**Why.** GitHub has no such screens, so the hand-off of [D3](#d3) cannot cover them, and someone signing in for the
first time from a phone would otherwise be stuck. Both are already full-width screens of their own, outside the
shell's side-by-side panes (`firstSignIn` routes, `packages/app/app/router.options.ts`), so fitting them to a
phone is cheap.

**Rejected.**

- Accepting the default choice (your own repositories) without asking on a phone — a member of an organization,
  whose repositories are not "theirs", would land in an empty My work with no way to fix it from the phone.

## D8

**The mobile layout is also what a future hybrid mobile app will show, the way the desktop app bundles the same
app; building that app is not part of this design.** (2026-11-06, owner said a hybrid phone app comes later; that
it reuses this layout is the design agent's proposal)

**Why.** The owner's aim is access to all of their GitHub work from the phone as comfortable as from the computer,
and a hybrid app is where that ends. Designing the phone layout once, for the browser, and reusing it there avoids a
second phone UI.

## D9

**No board on a phone in the first version: lists only, and the switch between list and board is not shown. A
project view saved as a board shows on a phone as a list grouped by the board's column field.**
(2026-11-06, owner said to leave the board for now; how a board view shows is the design agent's proposal)

**Why.** The owner set the board aside. A board's columns are the values of the field it groups by, so a list
grouped by that field holds the same items in the same order of groups, and the view stays usable.

## D10

**The bottom bar shows on list screens only. On an item's screen the bottom belongs to the comment box.**
(2026-11-06, owner, picked from the drawings: `MB23` in `githq.pen`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: on an item the part of the place you are in
no longer matters, because back returns to it, and two stacked bars leave little room for reading.

**Rejected.**

- The bar everywhere with the comment box above it (MB24) — two bars take 136 px with the home indicator, for a jump
  that back and one tap already give.
- The bar everywhere with the comment box behind a button (MB25) — every reply costs an extra tap.

## D11

**A link that leaves githq for github.com on a phone says so before it is tapped, with a ↗.** Only links the phone
does not show carry the mark. (2026-11-06, owner, picked from the drawings: `MB49`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: a phone has no hover to tell you where a link
goes, and the hand-off of [D3](#d3) is otherwise a surprise.

**Rejected.**

- Plain links (MB50) — the first you know of the hand-off is github.com filling the screen.

## D12

**A phone shows that the copy is not fresh in three places: a strip under the top bar that appears only when
something is off, a toast above the dock for an edit that failed, and the freshness and API allowance always in the
places panel.** (2026-11-06, owner, picked from the drawings: `MB51`, `MB52`, `MB53`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: a phone has no room for the desktop's status
bar, while "your edit did not go through" and "githq cannot reach GitHub" must still be seen.

**Rejected.**

- Only a dot on the menu button (MB54) — easy to miss, and stale data is what you should not miss before acting.
- A strip above the dock (MB55) — it makes the bottom heavier while you read.

## D13

**The command menu's button is ⌘.** (2026-11-06, owner, picked from the drawings: `MB57`; where the button sits is
still open, [variants.md](variants.md))

**Why.** The owner gave no reason beyond the pick. It names the same thing as ⌘K on the computer.

> **Not settled by this:** ⌘ is a key from Apple keyboards. Someone on Android, or who only knows githq from Windows,
> has no ⌘ to recognize; no one has tested how they read it.

**Rejected.**

- The violet slash of git/hq (MB56) — the design agent's recommendation; the owner chose otherwise.
- A magnifying glass (MB58) — it undersells the menu: nobody looks under search for closing an issue.
- A labelled pill (MB59) — it does not fit beside My work's five tabs.
