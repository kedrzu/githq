# githq on a phone

githq is a fast, keyboard-first client for GitHub Issues, pull requests and Projects across all your repositories
([the app's own design](../githq/README.md)). This design is the same web app opened on a phone: a layout for a
narrow screen, navigation that works with a thumb instead of a keyboard, and a first version that does the everyday
things and leaves the rest to github.com.

## Why

githq is built for a computer. Its screens sit side by side — a sidebar, a list, the opened item in a panel next to
it — and everything is reached from the keyboard, the command menu with ⌘K above all. On a phone none of that
works: the panes do not fit, and there is no keyboard to press. So away from the computer, your GitHub work is back
on github.com or GitHub's own app, spread across repositories the way githq exists to avoid.

The owner wants access to all of their things on GitHub from the phone that is as comfortable as from the
computer. The web app comes first; a hybrid phone app will follow, and it will show the same layout, the way the
desktop app bundles the same web app ([why the layout is designed once](DECISIONS.md#d8)).

## What is different once it exists

You open githq.dev on your phone and land on My work: what is assigned to you, your pull requests, the reviews
waiting on you. It is there at once, from the copy githq keeps in the browser, as on the computer. You tap a pull
request and it fills the screen; you go back and you are where you were in the list. In a repository, its issues
and its pull requests are one tap apart. On an issue you change its assignee or its Status in a project, write a
comment, or close it — and since there is no ⌘K, one button opens the command menu, which already knows the issue
you are looking at.

When a link leads somewhere githq does not show on a phone — a commit, a pull request's changed files — it opens on
github.com, the same way every address githq does not show at all already does.

## What the first version does

The daily loop, and nothing around it: My work; a repository's issues and pull requests; a project, as a list — no board on a phone yet, and a view saved as a board shows as a list grouped the same way
([the board](DECISIONS.md#d9));
opening an item, reading it, commenting, changing its assignees, labels and project fields, opening or closing it;
creating an issue; the command menu from a button. And signing in for the first time, because someone whose first
contact with githq is on a phone has to be able to choose what to track
([why the first sign-in cannot wait](DECISIONS.md#d7)).

Commits, code review, Actions, changing what you track, and merging come later
([the scope](DECISIONS.md#d4)). Until then their addresses go to github.com
([why not a "not on mobile yet" screen](DECISIONS.md#d3)).

## What makes it a phone

The app takes the phone layout when its window is narrow, not when the device is a phone. A narrow window on a
computer cannot fit the side-by-side panes either, and keying the features to the device would leave a third case
— the phone layout with commits and code review in it — that nobody designs. Resizing never sends you anywhere:
whether an address goes to github.com is decided when you navigate to it, so narrowing the window in the middle of a
code review does not throw you out. The desktop app keeps its window wider than that and never becomes the phone
layout ([the width, and what was rejected](DECISIONS.md#d5), [the desktop app](DECISIONS.md#d6)).

## Moving around

The desktop's panes become screens you go into and come back from: the sidebar's places (My work and its groups,
projects, repositories) at the top, a list inside one of them, an item inside a list. An item already has a
full-page form with its own GitHub address, so the deepest level exists today.

How you move between them is chosen by drawing, not by argument. The direction is set — classic phone navigation
that makes good use of the top-left and top-right corners, with every menu opened by a button and none by swiping
from the edge of the screen, which the iPhone's browser uses for its own gestures
([the direction](DECISIONS.md#d1), [no edge swipes](DECISIONS.md#d2)). A place's parts live under a command line that floats over the bottom of every screen, with no tab bar: one wide
button on a list, the comment box and ⌘ side by side on an item ([the line](DECISIONS.md#d17)). How the rest of the navigation
works is settled in [the decisions](DECISIONS.md), each from drawn variants ([how they were drawn](variants.md)).

## Where this stands

Settled: what makes the app a phone, the first version's scope, what happens to the addresses it does not show,
and the first sign-in. Not yet touched: the item's screen on a phone (its properties, activity and comment box in
one column), and how a list row shrinks to a phone's width. The navigation is drawn in `githq.pen`, frame
`App · Mobile`, from [the brief for the design agent](ui/navigate-on-a-phone.md). The owner has picked the command line
instead of a bottom bar ([D17](DECISIONS.md#d17)), the command menu rising from below ([D16](DECISIONS.md#d16)), its
button as ⌘ ([D13](DECISIONS.md#d13)), two buttons in the top-right corner ([D14](DECISIONS.md#d14)), links that say
they leave ([D11](DECISIONS.md#d11)), what shows when the copy is not fresh ([D12](DECISIONS.md#d12)), the button
leaving inside a task ([D18](DECISIONS.md#d18)) the places as a panel from the left ([D19](DECISIONS.md#d19)), back on an item
([D20](DECISIONS.md#d20)) and Commits and Actions offered in the command menu as leaving ([D21](DECISIONS.md#d21)).
Nothing drawn is left to pick.

githq's own Settings works on a phone too, all but its tracking section, because its address on github.com is
GitHub's account settings and handing it off would land somewhere else ([Settings](DECISIONS.md#d22)). The screens
come next, path by path, starting with the one githq on a phone exists for: seeing what needs you and acting on it
([its brief](ui/act-on-my-work-on-a-phone.md)).
