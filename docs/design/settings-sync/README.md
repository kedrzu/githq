# Settings that follow you between devices

githq remembers what you set up in it: which repositories and projects you track, how each list is
displayed, your other preferences. This design keeps those settings in your own GitHub account, so that
signing in on another computer brings them back. githq still has no server holding anything of yours; the
settings live where GitHub can see them, and you can delete them there.

## Why

Today every one of these choices lives in one browser. Sign in on a second computer and githq asks you to
choose your repositories again, with every list back to its defaults. Sign out, and the same happens on the
computer you were using, because signing out clears what the browser holds.

## What is different once it exists

You set githq up on your laptop. A checkbox on that first screen, already ticked, says your settings will be
saved to your GitHub account. A week later you sign in on your desktop. Instead of the list of repositories
to choose from, githq says it found your settings and offers to load them. You accept, and the sidebar and
your lists look the way you left them. From then on, a repository you start tracking on one computer appears
on the other.

If you untick the box, nothing leaves the browser, and githq works as it does today. A separate settings
screen, which githq does not have yet, lets you change your mind later.

Some things deliberately stay on each device, because they describe what you were looking at rather than
what you prefer. When you come back to a repository, githq opens the tab you last had open there, Pull
requests or Issues, but your desktop does not jump to the tab you left open on your laptop.

## Where this stands

This is at the start. [Where the settings are stored and what the choice costs](DECISIONS.md#open-questions)
is the question being argued now, and the rest of this story gets written once it is settled.
