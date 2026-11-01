# Settings that follow you between devices

githq remembers what you set up in it: which repositories and projects you track, how each list is
displayed, your other preferences. This design lets you keep those settings in your own GitHub account, so that
signing in on another computer brings them back. githq still has no server holding anything of yours; the
settings live where you can see them, and you can delete them there.

## Why

Today every one of these choices lives in one browser. Sign in on a second computer and githq asks you to
choose your repositories again, with every list back to its defaults. Sign out, and the same happens on the
computer you were using, because signing out clears what the browser holds.

## What is different once it exists

You set githq up on your laptop. A checkbox on that first screen offers to save your settings to your GitHub
account. It starts unticked, and you tick it. A week later you sign in on your desktop. Instead of the list of
repositories to choose from, githq says it found your settings and offers to load them. You accept, and the sidebar
and your lists look the way you left them. From then on, a repository you start tracking on one computer appears
on the other.

If you leave the box unticked, nothing leaves the browser, and githq works as it does today. A separate settings
screen, which githq does not have yet, lets you change your mind later.

Some things deliberately stay on each device, because they describe what you are looking at rather than what you
prefer: a list's filter, how wide a panel is, how items open. When you come back to a repository, githq opens the tab
you last had open there, Pull requests or Issues, but your desktop does not jump to the tab you left open on your
laptop. [Exactly what travels and what stays](DECISIONS.md#d7).

## Where the settings are kept

Saving your settings creates a private repository with a fixed name in your account, holding one file. That sounds
heavier than the obvious place, a secret gist, and it is why saving is something you ask for rather than the default.
But a secret gist can be read by anyone who has its address, while the settings name your private repositories. It would
also make githq ask every user for write access to all their gists, even those who never turn this on, and it has no
unique name, so githq would have to read through all your gists to find its own. A repository needs no permission beyond
those githq already has, and it can be found with one question.

A repository also protects your changes. If two computers save at the same moment, GitHub refuses the second write
instead of letting it erase the first. [The comparison, and what we tested](DECISIONS.md#d6).

## When two computers disagree

Each computer remembers the version of the file it last saw. What differs from that version is what it still has to save, and
this is all it takes, even if the tab closes before the write. When it saves, it compares three things: its settings, the file as
it is now, and the version it remembers. A repository added on one computer and another added on the other both stay. If both
changed the same setting, what is already saved wins. [How the merge works](DECISIONS.md#d11).

The same comparison runs when you first turn saving on, on a computer that already has settings, so your tracked lists are
combined. And when anything gets in the way, such as a repository you deleted or a file edited into something unreadable, githq
[stops syncing and says why](DECISIONS.md#d12). It keeps working from what it has and never overwrites a file it cannot read.

## What this leaves open

[Some risks we would accept, the reach of the last-view memory and the order of building](DECISIONS.md#open-questions) are
waiting for a decision.
