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

**githq is an issue tracker.** Almost everyone who builds something wants to keep track of what is going on in
their projects, and the dedicated tools either cost money per seat once you outgrow a free tier or have to be
hosted yourself. GitHub is already there, holding the code. githq makes the tracker GitHub already has
pleasant enough to use every day. [The owner's call](DECISIONS.md#d1).

**It is measured against Linear.** Naming the tool githq replaces tells a reader at once what kind of thing
this is and what it saves them. [The owner's call](DECISIONS.md#d2).

**Why now: even a solo developer is a manager.** With many repositories and agents opening pull requests in
all of them, one person no longer writes most of the code; they hand out work, and then review, merge and fix
whatever came back red. That job used to need a team before it needed a tracker. Now it needs one on day one,
and it needs a tracker that shows not only the tasks but what came back: pull requests waiting, checks
failing, a deploy broken overnight. That is where merging, stacks and Actions fit — as what a tracker for this
kind of work has to show, not as a second product. [Proposed, not yet confirmed](DECISIONS.md#d3).

## What is still open

Three candidate openings of the landing page, each for a different first reader, are in [headlines.md](headlines.md).

- How the "manager" idea sits on the landing page: a section of its own, the opening of the features, or the
  subhead under the headline.
- Who the first reader is: a solo developer running agents, an open-source maintainer, or a small team.
- Which surfaces change, and in what order.
