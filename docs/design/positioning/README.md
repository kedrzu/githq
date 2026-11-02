# How we talk about githq

This design settles what githq says it is: the one sentence at the top of the landing page, the README, the
repository's description on GitHub, the page title, and the "What this is" paragraph agents read in
`AGENTS.md`. It decides the message, not the wording of every line; the copy follows from it.

## Why

githq started as a fast task manager on top of GitHub Issues and Projects, and everything public still says
exactly that: "Linear's speed, GitHub's data". The product has since grown past it. It merges pull requests,
handles stacks of them, is about to show failing GitHub Actions across repositories, and code review is meant
to follow. The landing page now says things that are no longer true ("reviews stay where diffs belong"), and it
says nothing about half of what the app is for.

The obvious way out, "everything for GitHub in one place", names no need. Someone who has never used githq does
not feel that browsing GitHub could be better; the people who use it feel it only afterwards.

## What is different once it exists

Someone landing on githq.dev understands in one sentence a need they already know they have, and in the next
few why it is sharper for them now than it was two years ago. Every surface tells the same story, so a feature
we add next slots into it instead of contradicting it.

## The message

**githq is one place to manage all your repositories, and the tracker comes with it.** Two promises in one
sentence. You work in ten repositories, and GitHub shows each of them on its own pages: issues here, pull
requests there, a failed deploy in a third repository's Actions tab. githq puts all of it on one fast screen.
And because issues and Projects are already part of that GitHub, you do not need a separate tracker for those
ten repositories either. Neither half is enough alone: "a tracker" sells a need the reader may not feel, and
"one place for your GitHub" names no work to be done. [The owner's call](DECISIONS.md#d4).

**Linear is what it replaces, not what it is.** Naming Linear tells a reader at once what they no longer need
to pay for and keep in sync, but githq is not described as "Linear on GitHub". [The owner's
call](DECISIONS.md#d2).

**Why now: even a solo developer is a manager.** With many repositories and agents opening pull requests in
all of them, one person no longer writes most of the code; they hand out work, and then review, merge and fix
whatever came back red. That is why both halves matter at once: the issues are what you hand out, and the pull
requests, checks and broken deploys are what comes back. [Proposed, not yet confirmed](DECISIONS.md#d3).

## What the landing page says

It opens with *All your repositories in one place. No separate tracker.*, then shows the first promise with My
work across repositories, the second with the comparison against github.com and a dedicated tracker, and ends
the opening with why it matters now. The older sections follow, numbered on from there: the GitHub concepts, Instant,
Keyboard and Faithful to GitHub (04–06), the details, open source and the last call to action. What repeated the
opening is gone: the "Not another tracker" statement and the separate My work feature. "Reviews stay where diffs
belong" gave its card to stacks of pull requests, and the last call to action speaks of every repository, not
only issues. The variants it was chosen from are in [headlines.md](headlines.md);
[the owner's pick](DECISIONS.md#d6).

## What is still open

- The page and the README describe failing workflows across repositories ahead of the code, because that work is
  about to land. The page also promises merging, which is not built; the README calls it "next".
- The sign-in screen that shows the landing and the share images in `githq.pen` still carry the old headline.
- The repository's description on GitHub still says "task manager"; the open source card on the page already
  uses the README's line.
- Who the first reader is: to be learned from talking to people, not decided here.
