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
work is in belongs to My work; each repository's progress to the status bar ([D4](#d4)); organisations hiding their
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

Built by changing the existing frame (`FirstSignInFrame.vue`): its header becomes the shared strip, the step indicator
goes. No second frame component.

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

The closed-items phase reuses the shape freshness already has for a counted first read (`partial`, or `filling`'s
`done`/`total`) rather than adding a kind to a union of about twenty; the rest of the rule is what `getFreshness`
already does.

**Rejected.**

- Showing every poll as it runs — constant and meaningless once refresh is frequent.
- Showing a refresh that found changes while it fetches them — they show up in the list anyway, and it would make the
  marker flicker with ordinary activity.

## D4

**While any tracked repository or project is downloading, the status bar's sidebar segment says so in place of the API
allowance — how many are downloading, items so far of the total counted, and the time left once a pace is known. It is
not a button: no list behind it. It is the only place that speaks of repositories downloading; each screen's own segment
still says what is happening to that screen ([D3](#d3)). It returns to the allowance when everything has arrived. Being offline or
paused by the allowance still takes the segment first.** (2026-11-06, owner)

**The sidebar's entries show no download marker:** a tracked repository or project shows nothing in place of its
count until its open items are in, then its count. (2026-11-06, owner)

**Why.** With the download page gone ([D1](#d1)) no screen owns the progress of everything at once, and from My work the
user would otherwise not know whether the rest takes a minute or twenty. It follows [D3](#d3): it shows only while data
is actually missing, so the same holds for a repository tracked later, not only on the first sign-in. The figures exist
already — the old page summed `TrackingStore.getProgress` per tracked target and estimated time from the pace after five
seconds (`packages/app/tracking/FirstDownloadPage.vue`, `PACE_AFTER_MS`).

**Rejected.**

- A marker on each sidebar entry while it downloads (today's percentage, `SidebarTrackedStatus` `downloading` in
  `packages/app/shell/Sidebar.vue`) — the owner wants download progress in one place only, the status bar.
- No overall progress, each repository speaking only for itself (its sidebar entry, its own status bar) — from My work
  nothing says how much is left.

## D5

**The screens that can be incomplete, and what each waits for:** (2026-11-06, owner)

- **My work** — the user's own issues and pull requests; the one screen that can be wholly empty right after sign-in,
  and the main home of the "fetching" empty state.
- **A tracked repository** — its open items first (empty state until then), then its closed items (the status bar says
  how far, not "Up to date").
- **A tracked project** — all its items at once, as its download reads them.
- **An untracked repository being browsed** — its first read.

**Why.** These are the surfaces with a freshness of their own ([githq D15](../githq/DECISIONS.md#d15)); each already
knows when it has nothing yet (`partial`), and only a tracked repository has a second phase that today reads `fresh`
([D3](#d3)).

**Rejected.**

- An opened issue's or pull request's comments and details as an incomplete screen (design agent's addition) — a
  separate mechanism already covered by githq Q8, and not what the owner asked about.

## D6

**Every empty screen or list says which of four reasons it is empty for — still arriving, nothing there, filtered out,
or can't be read — and never says "nothing" (the second or third) while the first or fourth holds.** (2026-11-06, design
agent's proposal, not yet confirmed)

**Why.** The owner wants the "wooden" empty states designed; the inventory ([empty-states.md](empty-states.md)) shows
that the ones that hurt most are not plain but wrong: a tracked repository still downloading says "No issue matches.
Try another state", a project still downloading offers to add items, an arriving line spins on while offline. Naming
the reason is what separates "empty can be trusted" (githq K4) from a guess.

## Postponed

- **A "loading more" row at the end of a list** (owner, 2026-11-06). Lists sort by last update, so arriving items land
  between rows, not at the end; and the default filter shows open items, which arrive first. Truthful only under
  filters that include what is still arriving.
