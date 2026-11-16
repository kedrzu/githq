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
`O` to `G`. githq tells you that `G` is already used by a command that can be active at the same time, before you
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
conflict. `1` picking a repository section and `1` picking a My work filter never meet; `C` for a new issue and
`C` for commenting on a line in a review do.

So each definition also says where the command can be offered, and githq can check a key against every other
command that can be offered in the same places, without any screen being open.
[Why this is declared rather than discovered](DECISIONS.md#d3). How those places are described, and what
happens when a screen's command deliberately takes a key that a wider one also uses, is the open question of this
design (see below).

## Keys that are not commands

Moving through a list with `J` and `K`, checking a row with `X` or opening it on GitHub with `O` are commands like
any other: they can be rebound and are listed with the rest. The arrow keys, Enter, Escape, Tab, and the keys a
text field or a dialog form owns while it has focus are not. They are how a control behaves, the same everywhere
on the web, and are shown in the list of keys but cannot be changed.
[Where the line is drawn](DECISIONS.md#d4).

## The name

githq already calls these commands: the command menu, its documentation and the code all use the word. "Action"
would have been the obvious alternative, but in githq Actions means GitHub Actions, which has its own screens.
`defineCommand` is already taken in the code by the dependency-injection library for something unrelated, so the
function that defines one has a different name. [The naming](DECISIONS.md#d5).

## What is still open

- How the places a command can be offered are described, and whether a screen-specific command may shadow a
  wider one's key (today a review's `C` hides the global "new issue" `C`) without that counting as a conflict.
- What happens when one command is offered by two places at once, such as "Open on GitHub" for the selected row
  and for the item open beside the list.
- Commands that come in numbered families: views on `1`–`9`, repository sections on `1`–`4`.
- Where your own keys are kept: on this device, or with the settings that can follow you between devices.

## How far this goes

This design settles how commands are defined, offered, shown and rebound. Going through the existing commands to
merge duplicates and resolve their key clashes is not part of it; that happens command by command when they are
moved onto the definitions. Key sequences such as `G` then `I` are not part of it either.
