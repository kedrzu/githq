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
or can't be read — and never says "nothing" (the second or third) while the first or fourth holds. When several hold,
the first in this order wins: can't be read, still arriving, filtered out, nothing there. The owner designs one pattern
per reason; which screens have which reasons is in [empty-states.md](empty-states.md#what-each-screen-can-say).**
(2026-11-06, design agent's proposal, owner confirmed; the order is the design agent's)

**Why.** The owner wants the "wooden" empty states designed; the inventory ([empty-states.md](empty-states.md)) shows
that the ones that hurt most are not plain but wrong: a tracked repository still downloading says "No issue matches.
Try another state", a project still downloading offers to add items, an arriving line spins on while offline. Naming
the reason is what separates "empty can be trusted" (githq K4) from a guess. The order: what can't be read won't arrive
now, so saying "arriving" then would spin forever; what is still arriving may be exactly what a filter asks for (closed
issues under "Closed"), so "nothing matches" would be false.

"Can't be read" is one pattern whose one line names the cause in the words the status bar already uses (offline,
paused until a time, GitHub failing, hidden or gone) and offers the action that cause allows; a screen does not get a
design per cause. It is shown only when the screen has nothing; with rows on screen the status bar alone tells it. An
arrived, empty group inside a list that has other rows keeps its "Nothing here." line: its header says what it is.

**Rejected.**

- "Can't be read" split in two, lasting (no access, gone) and passing (offline, paused, failing) — the difference is in
  the line and the action, not the look; one pattern fewer to design (owner, 2026-11-06).

- Fixing only the screens that say something wrong or show a bare line, the rest left until someone meets them — the
  owner wants the plain states designed too, and most of the table is "kept" anyway (owner, 2026-11-06).

- Designing each screen's empty state on its own — the wrong ones today are wrong in the same way, and nothing stops the
  next screen repeating it.

## D7

**The empty-state work covers whole screens and lists. Small lines inside panels and pickers ("No comments yet.",
"Nothing matches" in the command menu) stay as they are; an item's properties reading "None" before they are read is
fixed as a bug, not designed.** (2026-11-06, design agent's proposal, owner confirmed)

**Why.** A line inside a panel already states its reason in a sentence, which suits its size; the screens are where
"nothing" is shown big and believed.

**Rejected.**

- Every empty line in the app — dozens of one-liners that already say what they mean.

## D8

**Every empty screen or list tells its reason through one of four components, each drawn for a full screen, a list's
group and a board column (ES1). Still arriving is ghost rows alone (ghost cards on a board) where the rows will land,
with no status line: a dozen on a full screen fading slowly from full strength, three in a group or a column. Nothing
there, filtered out and can't be read are the centred note the app already uses (K4, J7): an icon, a title, one line,
at most one action; in a group one quiet line under the header; in a board column a small centred note.**
(2026-11-06, owner picked the design agent's Variant A, without its "Fetching from GitHub" line)

**Why.** The skeletons say plainly that something is loading, and the status bar says what (D4, D14); rows replace
the ghosts in place, so nothing jumps when data lands. The same shape already shows files still arriving in code
review (#205). The owner found seven rows fading to zero too faint: more rows, wider bars, a slower fade.

Components (`Components · Empty states`): `Empty / Still arriving · screen | group | column`, `Empty / Nothing there ·
…`, `Empty / Filtered out · …`, `Empty / Can't be read · …`, built on `Empty / Note · screen | group | column`,
`Empty / Ghost row`, `Empty / Ghost card`.

**Rejected.**

- One centred note for all four, still arriving with pulsing dots (ES2, deleted) — a screen still arriving looks as
  blank as an empty one until it is read.
- A line at the top for all four, still arriving ticking through My work's groups (ES3, deleted) — a 1,200px pane
  stays almost empty above the fold, and the ticker exists only where groups are known.
- A status line over the ghosts ("Fetching from GitHub · Rows appear as they arrive", with pulsing dots) — the
  skeletons already say it (owner).

## D9

**The ghosts carry the motion alone: a soft highlight runs left to right along the skeleton bars themselves, never over the background between them, a full pass every 1.6 s,
each row 80 ms after the one above; an arriving row fades in over its ghost in 150 ms and the ghosts below move down.
With animations off (Display, CH49) the ghosts stand still.** (2026-11-06, design agent's proposal; the owner asked
that it visibly move) — ES4

Every skeleton in the app is built from one shared set — a wrapper holding the rhythm, and the shapes inside it (bar,
circle, dot) — and code review's file placeholders use it too. All shapes inside one wrapper share one highlight: a
single band crosses the whole row (a gradient anchored to the wrapper, which the shapes only cut out), so no circle or
bar animates on its own. (2026-11-06, owner, at the start of the build)

**Why.** With no words the motion is what tells "something is happening"; a sweep reads as work in progress, a blink
as a fault. Shapes animating each on their own would look chaotic (owner). The owner's words for the tone: "fetching", "crunching", "churning".

## D10

**The still-arriving state shows no numbers or words; the status bar holds them.** (2026-11-06, design agent's proposal)

**Why.** Counts grow while a download runs ("of 8,000" rises once closed items are counted), so a number in two
places doubles the jitter. The screen's own status bar segment is right below the list and already says "Downloading
open issues · 40 of 142" (ES14).

## D11

**The left segment while downloading shows items so far of the total and the time left, e.g. "1,240 of 8,000 · about
2 min"; "Downloading · counting…" before the first count; how many repositories and projects are downloading is in the
hover title. On the rail (56px): the time left ("2m") once a pace is known, the turning icon alone before. Who has the
segment, in order: offline, paused by the allowance, downloading, the allowance.** (2026-11-06, owner picked ES5; the
rail and the order are the design agent's) — ES5, ES8

**Why.** The brief's example, "Downloading 4 repositories · 1,240 of 8,000 · about 2 min", is about 330px of text in a
236px segment. The number and the time are what change, so they stay in sight. Offline and paused tell why nothing
moves, which matters more than how far it got.

**Rejected.**

- "Downloading 5 · about 2 min" (ES6, deleted) — items of the total leave sight.
- A bar along the segment's top edge (ES7, deleted) — it moves backwards when a total grows, which reads as a fault;
  on the rail a percentage does the same.

## D12

**"Can't be read" per cause (ES25):** (2026-11-06, design agent's proposal)

- **Offline** — "You're offline"; "{thing} hasn't arrived yet, and githq can't reach GitHub. It carries on by itself as
  soon as you're back."; no action.
- **Paused by the allowance** — "Refresh paused until 14:20"; "GitHub's hourly allowance ran out before {thing} was
  read. It comes in by itself at 14:20."; no action.
- **GitHub failing** — "GitHub isn't answering"; "githq couldn't read {thing}. It tries again every 30 seconds.";
  "Try again".
- **Hidden or gone** — "GitHub doesn't show {thing}"; "It may be private to githq, its organisation may not have
  approved githq, or it is gone."; "Open on GitHub".

The icon is amber (cloud-off, pause, triangle-alert, eye-off), as the status bar's stale states are.

**Why.** The title is the status bar's own words, so the two read as one; offline and paused resolve by themselves,
so a button would only invite pressing it.

## D13

**The choosing screen's strip: the wordmark at the left (right after the window buttons on the Mac), the account at
the right, nothing between, no border under it. On the web and Windows the strip is the same without the buttons.**
(2026-11-06, design agent's proposal) — G2, G15; `Track / Top bar`, `Track / Top bar · macOS`

**Why.** Above the app's sidebar the strip has no border either; a border would bring back the bar that "jumps".

## D14

**While a screen's data is still arriving, its own status bar segment says what it waits for: "Fetching your work",
"Still arriving · assigned to you, mentions" (My work), "Downloading open issues · 40 of 142" (a repository),
"Downloading items · 0 of 128" (a project), "Reading commits". My work's total in the sidebar stays blank until every
group is in.** (2026-11-06, design agent's proposal) — G16, G17, ES14, ES18, ES21

**Why.** D4 gives each screen's segment the screen's own story; a partial total would read as the whole.

## D15

**My work narrowed to one group from the sidebar, and that group empty, is filtered out: the note says what is
shown and offers the rest ("Nothing mentions you … Your other 10 items are in My work.", "Show all of My work").**
(2026-11-06, design agent's proposal) — ES12

**Why.** The brief files it under filtered out. The note keeps it from reading as the whole of My work being empty.

## D16

**G6 (the download page) and G7 (the earlier draft of going straight into the app, with download percentages in the
sidebar) are deleted from `githq.pen`; G16 and G17 take their place.** (2026-11-06, design agent) — follows D1, D4

## D17

**Still arriving takes the shape of the screen it stands in, not one list shape for all: list rows for issues, pull
requests, projects and My work (ES1); a workflow row with its five-run strip for a repository's Workflows and for
Broken workflows, with the repository column there (ES27, ES28, fixing W16's centred "Not read yet"); a board shows
ghost columns when its columns aren't known yet (ES29) and the real column headers, without counts, over ghost cards
when they are (ES30). Commits are a skeleton in the graph's shape: the branch list on the left, a lane with commit
dots, message bars, author and date (ES21).** (2026-11-06, owner asked for workflows, commits and boards and picked
ES21 for commits; the shapes are the design agent's)

**Why.** A skeleton is worth having where the data lands in place of it, so it has to be the shape of what lands;
the same rows everywhere told nothing about the screen. For commits the skeleton is on screen a second or two at most
(the first page is small, CH32), but a centred loader would flash for that same second and the two-column layout
would appear all at once.

Components: `Empty / Ghost workflow row`, `Empty / Ghost commit row`, `Empty / Ghost ref row`, `Empty / Ghost column`,
`Empty / Still arriving · workflows | commits | board`. The motion of D9 runs on all of them.

**Rejected.**

- A turning loader in the middle of Commits, as today (ES26, deleted) — simpler, but the graph appears all at once after it.

## Postponed

- **A "loading more" row at the end of a list** (owner, 2026-11-06). Lists sort by last update, so arriving items land
  between rows, not at the end; and the default filter shows open items, which arrive first. Truthful only under
  filters that include what is still arriving.

## Notes for the owner

Raised by the screens, not settled by the brief (2026-11-06, design agent):

- **The repository's "Synced 14s ago"** in the bar above its issues (CH1, `Freshness`) shows every poll, against D3.
  ES9 hides it; whether it goes for good is the owner's call.
- **Which board columns are known before the items.** ES30 assumes a project's Status options come with the project
  and a repository's grouping (labels, milestones, issue types) does not (ES29); the sync engine decides which holds.
- **A commits total.** GitHub gives no cheap count of a repository's commits, so ES21's segment says "Reading
  commits" without numbers.
- **"Try again" has no key in the app yet**; the drawings use R. "Open on GitHub" keeps O, as in J7.
- **"Downloading 5"** counts repositories and projects together; the hover title names both.
