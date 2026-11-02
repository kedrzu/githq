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

**githq is one place to run all your repositories, and the tracker comes with it.** Two promises in one
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

## What is still open

Candidate openings of the landing page, each carrying both promises, are in [headlines.md](headlines.md).

- How the "manager" idea sits on the landing page: a section of its own, the opening of the features, or the
  subhead under the headline.
- Who the first reader is: a solo developer running agents, an open-source maintainer, or a small team.
- Which surfaces change, and in what order.
