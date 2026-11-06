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
(2026-11-06, proposal of the design agent; the owner raised no objection but has not confirmed the list)

**Why.** The owner asked for the basic functionality first, naming commits and code review as later. The rest of
the list is inferred from the desktop's first version, not from the owner; merging is the open edge.

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
