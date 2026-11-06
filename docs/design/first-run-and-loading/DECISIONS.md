# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

The product, its sync model and the first sign-in are decided in [the githq design](../githq/DECISIONS.md).

## D1

**The first sign-in has no download step: "Track these" goes straight to where the user was heading (`next`, My work
by default), and the download continues in the app, each screen saying for itself what is still arriving
([D3](#d3)).** (2026-11-06, owner)

**Why.** The page was a click and a wait before the app. Everything it told has a better home: whether the user's own
work is in belongs to My work; each repository's progress to its screen and sidebar entry; organisations hiding their
private repositories are already shown on the choosing screen.

> **Checked 2026-11-06:** leaving the old page stopped nothing — the download is the sync engine's
> (`packages/app/tracking/FirstDownloadPage.vue:1`). The hidden-organisation notice is rendered on the choosing screen
> (`packages/app/tracking/TrackingChooser.vue`, `ProjectChooser.vue` use `HiddenOrganizationNotice.vue`). My work
> already draws its groups still arriving (`packages/app/myWork/MyWorkView.vue:160`).

**Rejected.**

- The first download as a progress step the user can leave once My work is in (G6 in
  [githq D20](../githq/DECISIONS.md#d20)) — an extra click and a screen that only waits. G7, "straight into the app
  while downloading", was rejected in that same pick with no reason recorded; it is taken now because loading is to be
  shown inline on the screens instead.

## D2

**The choosing screen (and its variant offering saved settings) is a screen of its own, without a step indicator, whose
top is the app's 36px window strip (`$window-controls-height`, the drag region), so macOS's window buttons sit in the
same bar on every screen.** (2026-11-06, owner)

**Why.** With the download step gone ([D1](#d1)), the indicator would show two steps, one already done. The window
buttons are placed by the app at a fixed point, so what made them look misplaced was the bar around them changing
height.

> **Checked 2026-11-06:** the buttons are fixed at (10, 20) — `packages/desktop/src-tauri/src/lib.rs:85`. The sidebar
> and the desktop sign-in draw a `$window-controls-height` (36px) strip (`packages/app/shell/Sidebar.vue:537`,
> `packages/app/desktop/DesktopSignIn.vue:298`); the sign-in steps' frame a 56px header with a border
> (`packages/app/tracking/FirstSignInFrame.vue`, `.firstSignInFrame_top`).

**Rejected.**

- The choosing screen inside the app's shell (sidebar, status bar) — before anything is chosen the sidebar would be
  empty and My work's counts zero.
- Keeping the 56px header and step indicator — the indicator loses its meaning, and the header is what moved the
  window buttons' surroundings.

## D3

**A screen shows that it is loading only when it lacks data it is going to have — a first download, a repository's
closed issues still arriving, an untracked repository's first read. It never does when the data it has is complete and
only being checked for changes, including a refresh that found changes and is fetching them. In particular a tracked
repository is not "Up to date" while its closed items are still downloading.** (2026-11-06, owner)

**Why.** githq polls constantly; a marker lit by every request would always be lit and mean nothing. What the user
wants to know is whether what they see is all there is. Changes found by a refresh appear in the list on their own.

> **Checked 2026-11-06:** a tracked repository's freshness turns `fresh` as soon as its open items arrive
> (`getRepositoryFreshness`, `packages/app/sync/SyncEngine.ts:356`, via `haveOpenItemsArrived`), while the download's
> later phases go on, counted per phase (`getProgress`, `packages/app/tracking/TrackingStore.ts:479`). A poll running
> while fresh deliberately reads `fresh` (`packages/app/sync/Freshness.ts`, `getFreshness`).

**Rejected.**

- Showing every poll as it runs — constant and meaningless once refresh is frequent.
- Showing a refresh that found changes while it fetches them — they show up in the list anyway, and it would make the
  marker flicker with ordinary activity.

## Postponed

- **A "loading more" row at the end of a list** (owner, 2026-11-06). Lists sort by last update, so arriving items land
  between rows, not at the end; and the default filter shows open items, which arrive first. Truthful only under
  filters that include what is still arriving.
