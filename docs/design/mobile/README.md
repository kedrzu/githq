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

The daily loop, and nothing around it: My work; a repository's issues and pull requests; a project, as a list — no board on a phone yet, and a view's layout saved on GitHub does not reach the phone
([the board](DECISIONS.md#d9), [D41](DECISIONS.md#d41));
opening an item, reading it, commenting, changing its assignees, labels and project fields, opening or closing it;
creating an issue; the command menu from a button. And signing in for the first time, because someone whose first
contact with githq is on a phone has to be able to choose what to track
([why the first sign-in cannot wait](DECISIONS.md#d7)). And Settings, with the same sections as on the computer,
what you track included: a phone's settings are not necessarily synced from the computer, and a phone that could not
change what it tracks would be stuck with its first choice. Only the computer's layout settings are left out
([what Settings holds on a phone](DECISIONS.md#d30)).

Commits, code review, Actions and merging come later
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

## The screens

The navigation, and two paths through the app, are drawn in `githq.pen`, frame `App · Mobile`.

**Getting around** ([its brief](ui/navigate-on-a-phone.md)). There is no tab bar. A command line floats over the bottom
of every screen: on a list one wide button that opens the command menu and names the part of the place you are in; on
an item the comment box beside it ([why no tab bar](DECISIONS.md#d17)). The command menu rises from below, its first
results nearest the thumb ([how it opens](DECISIONS.md#d16)). The top-left corner opens the places as a panel on a
list, and goes back, naming the list, on an item ([the panel](DECISIONS.md#d19), [back](DECISIONS.md#d20)); the
top-right holds the list's options and New issue ([the corner](DECISIONS.md#d14)).

**Seeing what needs you and acting on it** ([its brief](ui/act-on-my-work-on-a-phone.md)). A row keeps what tells you
whether to open it, and the rest waits in the item ([the row](DECISIONS.md#d23)). On an item, the properties that need
their name are rows and the rest are chips ([the properties](DECISIONS.md#d25)); tapping one opens the command menu
straight at its choices ([changing a property](DECISIONS.md#d26)). A row swiped to the left offers Status, Assign and
Close ([swiping](DECISIONS.md#d27)).

**Setting githq up** ([its brief](ui/set-up-on-a-phone.md)). The first sign-in is the computer's in one column, with a
search that also asks GitHub, so a repository outside your own is found and ticked in the same list — and the computer
got the same search ([choosing what to track](DECISIONS.md#d34)). Settings opens on its list of sections, each a screen
of its own ([Settings](DECISIONS.md#d33)); what you track is listed there and added through the first sign-in's screen
([tracking](DECISIONS.md#d35)). The account at the foot of the places panel opens a menu, as on the computer
([the account](DECISIONS.md#d32)).

## Where this stands

Everything drawn has been picked; the decisions are in [the record](DECISIONS.md). A repository's list, a project with
hundreds of items and the new issue form were drawn with the navigation. The last round settled the list's options as
a sheet ([D36](DECISIONS.md#d36)); a view changed on a phone stays this device's own ([D37](DECISIONS.md#d37)) and no
board reaches the phone ([D41](DECISIONS.md#d41)); a new issue starts with its repository ([D38](DECISIONS.md#d38)),
sets its details as on an item ([D42](DECISIONS.md#d42)), gets its template after the repository
([D39](DECISIONS.md#d39)), and the toast after Create offers Create another ([D40](DECISIONS.md#d40)).
