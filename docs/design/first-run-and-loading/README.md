# The first run without a download screen, and loading shown where it happens

## What this is

Two linked changes to how githq behaves while it is still copying data from GitHub. The first sign-in loses its last
screen — a page of progress bars the user has to click through — and the screen before it, choosing what to track,
takes the same top bar as the rest of the app. In its place, each screen says for itself when what it shows is still
arriving: an empty screen says it is downloading rather than looking empty, and the status bar along the bottom says
how far a download is instead of claiming "Up to date".

## Why

Today, after choosing which repositories and projects to track, the user lands on a "First download" page: a bar per
repository, an overall bar, and an "Open My work" button that unlocks once their own issues and pull requests are in.
It is one more click before the app, and a page whose only job is waiting.

Once inside, the app says too little about what is still coming. A tracked repository's status bar reads "Up to date"
as soon as its open issues arrive, while its closed ones keep downloading for minutes; a screen with nothing on it yet
looks the same as one with nothing to show. The owner's word for it: the status bars feel dead, always saying
"Up to date".

There is also a visual seam on the desktop app on macOS: the window's close, minimise and zoom buttons sit in a 36px
strip above the sidebar inside the app, but in a 56px header with a step indicator on the sign-in screens, so the bar
around them jumps between screens.

The opposite failure matters as much. githq will refresh constantly in the background, and a marker that lights up on
every refresh would say "something is happening" all the time and mean nothing.

## What is different once it exists

Someone signs in for the first time, ticks four repositories and presses "Track these". They are on My work at once.
If nothing of theirs has arrived yet, the list says so — a short, light "fetching your work" state, not "nothing needs
you". Rows appear as they come. At the bottom left, the status bar says four repositories are downloading and roughly how long
is left. Opening one, its
status bar reads how far it is — its closed issues, so many of so many — and turns to "Up to date" only when the
repository is actually complete.

An hour later the app is polling GitHub every half minute, and none of that shows. Nothing on screen is missing, so
nothing says it is loading.

On the Mac, the window buttons sit in the same strip on the sign-in screen as in the app.

## How it works

**No download step.** "Track these" goes straight to where the user was heading, My work by default. The download is
the sync engine's and already continued when the user left the old page, so nothing about it changes; only the page
goes. What that page told is moved to where it belongs: whether the user's own work is in, to My work itself; how far
each repository is, to the status bar. Organisations that hide their private
repositories from githq were also listed there — they are already shown on the choosing screen, so nothing is lost.
[Why the step goes, and what it replaced](DECISIONS.md#d1).

**The choosing screen looks like the app.** With the last step gone, a step indicator would show two steps, one of
them done, so it goes too. The choosing screen (and its variant offering saved settings) stays a screen of its own —
not inside the app's sidebar and status bar, where the sidebar would be empty and My work's counts zero before
anything was chosen — but its top is the same 36px strip as the app's, so the window buttons sit the same way
everywhere. [Why a screen of its own with the app's strip](DECISIONS.md#d2).

**When loading is shown.** The rule: a screen shows that it is loading when it lacks data it is going to have — a
first download, a repository's closed issues still on their way, a repository opened for the first time without
tracking it. It never shows loading when the data it has is complete and is only being checked for changes, and that
includes a refresh that found changes and is fetching them: those simply appear in the list.
[The rule and what it turned down](DECISIONS.md#d3).

**Which screens can be incomplete.** My work waits for the user's own issues and pull requests, and is the one screen
likely to be wholly empty right after signing in. A tracked repository waits first for its open items, then for its
closed ones. A tracked project waits for all its items at once. A repository opened without tracking it waits for its
first read. [The list](DECISIONS.md#d5).

**Progress of everything at once.** No single screen owns it any more, so the left end of the status bar — under the
sidebar, where the API allowance normally sits — takes it over while anything is downloading: how many repositories and
projects, how many items of how many, and roughly how long is left. It is the only place that speaks of downloading
repositories: the sidebar's entries show no download marker of their own (an entry shows nothing until its open items
are in, then its count). Each screen's own segment still says what is happening to that screen. When all has arrived
the left end goes back to the allowance. Being offline or paused still comes first. This is not only for the first
sign-in: tracking another repository later shows the same. [Why there and not nowhere](DECISIONS.md#d4).

**Why a screen is empty.** A screen with nothing on it says why, and there are four reasons: its data is still
arriving; there is nothing there; a filter or view hides everything; or GitHub can't be read — no access, a failure,
offline, the allowance paused. It never says "nothing" while the data is still coming or can't be read: today a tracked
repository still downloading says "No issue matches. Try another state", and that is the kind of thing this removes.
When two reasons hold, what can't be read wins over what is arriving (it won't arrive now), and what is arriving wins
over a filter (it may be exactly what the filter asks for). Each reason gets one pattern, designed once.
[The four reasons](DECISIONS.md#d6), and [which screen can say which](empty-states.md#what-each-screen-can-say).

## How far this goes

In: the first sign-in after the choosing screen, the top bar of the sign-in screens, what the status bar says while a
screen's data is incomplete, and the empty state of every screen and list — not only one still downloading, but one a
filter leaves empty, one with nothing in it, one GitHub won't show. Small lines inside panels and pickers ("No comments
yet.") stay as they are ([why](DECISIONS.md#d7)).

Out of it: an opened issue's or pull request's parts fetched separately, which the main design already covers.

Out for now: a "loading more" row at the end of a list. Lists are sorted by last update, so arriving items land between
existing rows rather than at the end, and the default filter shows open items, which arrive first — such a row would be
truthful only under some filters. Postponed by the owner.

## Still open

- The four patterns' look, words and the arriving animation — the owner designs the screens.
