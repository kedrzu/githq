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
you". Rows appear as they come. In the sidebar the four repositories show they are still downloading; opening one, its
status bar reads how far it is — its closed issues, so many of so many — and turns to "Up to date" only when the
repository is actually complete.

An hour later the app is polling GitHub every half minute, and none of that shows. Nothing on screen is missing, so
nothing says it is loading.

On the Mac, the window buttons sit in the same strip on the sign-in screen as in the app.

## How it works

**No download step.** "Track these" goes straight to where the user was heading, My work by default. The download is
the sync engine's and already continued when the user left the old page, so nothing about it changes; only the page
goes. What that page told is moved to where it belongs: whether the user's own work is in, to My work itself; how far
each repository is, to that repository's screen and its sidebar entry. Organisations that hide their private
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
first read. An opened issue or pull request may wait for its comments, and says so inside its panel rather than as an
empty screen. [The list](DECISIONS.md#d5).

**Progress of everything at once.** No single screen owns it any more, so the left end of the status bar — under the
sidebar, where the API allowance normally sits — takes it over while anything is downloading: how many repositories and
projects, how many items of how many, and roughly how long is left. Clicking it lists each with its progress. When all
has arrived it goes back to the allowance. Being offline or paused still comes first. This is not only for the first
sign-in: tracking another repository later shows the same. [Why there and not nowhere](DECISIONS.md#d4).

## How far this goes

In: the first sign-in after the choosing screen, the top bar of the sign-in screens, what an empty screen says while
its data downloads, and what the status bar says while a screen's data is incomplete.

Out for now: a "loading more" row at the end of a list. Lists are sorted by last update, so arriving items land between
existing rows rather than at the end, and the default filter shows open items, which arrive first — such a row would be
truthful only under some filters. Postponed by the owner.

## Still open

- The empty state's words and animation — the owner designs the screens.
