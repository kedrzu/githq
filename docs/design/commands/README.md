# One definition for every command

Everything you can do in githq from the keyboard or from the command menu (⌘K) is a command: merge a pull
request, open an item on GitHub, assign someone, go to the next row. This design gives each command a single
definition, written once in one place: its name, icon and default key. A screen that offers the command says only
what it does there and when it is available. The command menu, the key hints on buttons, the list of keys and the
settings where you can change a key all read the same definitions.

## Why

Today a command is written wherever it is offered. Each screen builds its own entry with its own name, key and
icon. Opening something on GitHub is written about ten times, with two different icons and a separate translation
in each place, and merging is wired in four. The keys drift in the same way: `R` means comment, retry, check again
or reply depending on the screen, and nothing tells anyone when a new key collides with an old one. Besides the
command menu's own registry there are some eighteen separate key listeners and roughly a hundred and fifty key
hints typed into buttons by hand, which can say one key while another one works.

Because a command exists only while the screen that offers it is open, githq cannot show a list of all its
commands or check two keys against each other. That rules out the thing a keyboard-first app is expected to
have: letting you choose your own keys.

## What is different once it exists

Merge is one command. Whether you press its key on a row, open it from the item's menu or find it in ⌘K, it has
the same name, the same icon and the same key, and the button in the merge panel shows that key because it reads
it from the same place.

You open the settings and find a list of every command in githq with its key. You change "Open on GitHub" from
`O` to `G`. githq tells you that `G` is already taken by a command that can be active at the same time, before you
save, rather than letting one of them silently stop working. Once saved, `G` works on every screen that opens
something on GitHub, and every hint and menu entry shows `G`.

Pressing `?` shows the keys that work on the screen you are on, from the same definitions.

## What one command is

A command is the thing you would rebind. If you change the key for opening something on GitHub, you expect it to
change for issues, pull requests, repositories and workflow runs alike, so that is one command offered in many
places. Comment and retry both happen to use `R`, but nobody expects rebinding one to move the other, so they are
two commands. The name, icon and default key belong to the command, never to the place that offers it.
[Why the unit is what you rebind](DECISIONS.md#d1).

All definitions are collected and exported from one module, split into files by area, so the full list exists
whether or not a screen is open. A screen cannot invent a command on the spot: it can only take a defined one and
say what it does there. [Why definitions are static and collected](DECISIONS.md#d2).

What a screen adds to a command is what only it knows: what running it does, whether it can run now (and if not,
why), the current value to show beside its name, and the choices of a picker it opens.

## Knowing which keys collide

Rebinding needs to know whether two commands can be active at the same moment, since only then is a shared key a
conflict. `R` for commenting on an item and `R` for retrying in the settings never meet; `O` on the selected row of a
list and `O` on the item open beside it do.

So each definition also says where the command can be offered: the whole app, or one or more kinds of screen or
panel from a short list, such as a list, an open item, a review or a job log. A second short list names the ones that
can be on screen together, like a list with an item open beside it. Two commands with the same key collide if they
share a place or their places appear together on that list, and githq can check that from the definitions alone,
without any screen being open. [Why this is declared rather than discovered](DECISIONS.md#d3).

A screen may take a key that an app-wide command uses: in a review, `⌘B` shows the list of files rather than hiding
the sidebar. The settings show this as "here, ⌘B does this instead of that" rather than as a conflict, because
screens like a review are where single keys are worth most. [How places are described and when keys
collide](DECISIONS.md#d13).

Places are only for that check. Which command gets a key while you work is decided by what has the keyboard: with an
item open beside a list, the list keeps it, so `J`, `K` and `O` act on the selected row. That is also why `O` on both
is a conflict and not one taking over from the other: the item's would never run.

Keys that work across the whole app are few and never a bare letter by default: `⌘K`, `?`, `,` and `⌘B`. Letters
belong to screens, so a screen's letter never takes anything app-wide. Creating an issue, for example, is in the
command menu but has no letter of its own everywhere: githq is more than an issue tracker.
[Why no issue key](DECISIONS.md#d7), [the rule for app-wide keys](DECISIONS.md#d8).

## Keys that are not commands

Moving through a list with `J` and `K`, checking a row with `X` or opening it on GitHub with `O` are commands like
any other: they can be rebound and are listed with the rest. The arrow keys, Enter, Escape, Tab, and the keys a
text field or a dialog form owns while it has focus are not. They are how a control behaves, the same everywhere
on the web, and are shown in the list of keys but cannot be changed. [Where the line is drawn](DECISIONS.md#d4).

Neither can the numbers that pick the n-th thing on screen: a project's views on `1`–`9`, a repository's sections on
`1`–`4`. The number is the position, so there is nothing to rebind. Each such family is still one command, "Go to view
1–9", and the screen names what each number picks, so the command menu says `Go to "Backlog" view`.
[Why](DECISIONS.md#d9).

Fixed does not mean handled somewhere else. The numbers, `J` and `K` with the arrows beside them, and the Escape
that closes a panel are defined like every other command, only marked as not configurable, and run the same way, so
the list of keys can never show one thing while another runs. Only the keys a control owns while it has focus, Enter
in a field or Tab, stay with the control. [Why](DECISIONS.md#d11).

## What comes first in the command menu

Each command says how much it matters, and the command menu lists the more important ones first within each group.
Today a list's menu opens on changing its grouping, which is rarely what you came for. While you type, how well a
command matches comes first and its importance only breaks ties. [Why it belongs to the command](DECISIONS.md#d14).

## How it looks in code

A definition says what the command is: its id, title, icon, default key, the places it can be offered, how much it
matters, and whether its key can be changed. The definitions live in a few files by area and are exported from one index. A
component that offers a command takes a definition and says what running it does there and when it can run. A
button keeps its own label, which can depend on where it is, but reads its key hint from the definition, so it shows
the key you chose. [The shape](DECISIONS.md#d12).

## Where your keys are kept

The keys you change are kept with the settings that can follow you between devices, so rebinding once is enough.
With that switched off they stay in the browser, like every other setting. [Why](DECISIONS.md#d10).

## The name

githq already calls these commands: the command menu, its documentation and the code all use the word. "Action"
would have been the obvious alternative, but in githq Actions means GitHub Actions, which has its own screens.
`defineCommand` is already taken in the code by the dependency-injection library for something unrelated, so the
function that defines one has a different name. [The naming](DECISIONS.md#d5).

## How far this goes

This design settles how commands are defined, offered, shown and rebound. Going through the existing commands to
merge duplicates and resolve their key clashes is not part of it; that happens command by command when they are
moved onto the definitions. Key sequences such as `G` then `I` are not part of it either.
