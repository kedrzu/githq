# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D2

**The comparison with Linear stays, as what githq replaces.** (2026-11-02, owner)

**Why.** It tells a reader what kind of tool this is and what it saves them, in one name.

**Rejected.**

- "Linear on GitHub" as the identity, in the headline — it makes githq a clone to be compared feature by
  feature, and drops the half about running all your repositories (owner, 2026-11-02).

## D3

**The reason it matters now is that even a solo developer has become a manager of agents; merging, stacks,
Actions and review are presented as what a tracker for that work must show, not as separate products.**
(2026-11-02, design agent, not yet confirmed; the manager idea is the owner's)

**Why.** It ties the owner's two pains together: a solo developer did not need a tracker until they had many
repositories and agents working in them, and once they do, the tracker has to show what came back as well as
what was handed out.

**Rejected.**

- Agents in the headline ("an HQ for developers running agents") — githq does nothing agent-specific today, so
  the promise would outrun the product and date quickly (design agent).

## D4

**githq leads with two promises at once: one place to manage all your repositories, and no separate tracker for
them, because GitHub's issues and Projects are the tracker.** (2026-11-02, owner)

**Why.** Owner: openings that only said "it is a tracker, you need a tracker" did not land; the value is that a
tracker on GitHub replaces the one you would otherwise use for your ten repositories with agents, and that the
same place manages all of those repositories. "One place" on its own names no work; "a tracker" on its own sells
a need the reader may not feel.

> **Checked 2026-11-02:** "existing tools are paid" holds only past a free tier. Linear's free plan is
> reported as 250 issues and two teams with unlimited members, then $10 per user per month billed yearly
> (secondary sources, e.g. [omidsaffari.com](https://omidsaffari.com/blog/linear-pricing); linear.app/pricing
> did not render for the fetcher, so not confirmed first-hand). Plane's free cloud plan allows 12 users
> ([plane.so/pricing](https://plane.so/pricing)); it is open source and self-hostable. So the honest claim is
> "a second tool, a sync, and a bill once you grow", not "everything else costs money".

**Rejected.**

- Leading with the issue tracker alone ([history](history/DECISIONS.md#d1)) — the three openings written
  from it (the tracker you already have; you are the manager now; Linear on GitHub) all read as "you need a
  tracker" (owner).
- "Everything for GitHub in one place" — names no need (owner). D4's "one place" differs by being tied to the
  reader's repositories and to the tracker.

## D5

**The copy says githq is a command center for your repositories, and never says it "runs" them.**
(2026-11-02, owner)

**Why.** Owner: "run your repositories" suggests a runtime or hosting, which githq is not. "Command center"
is the owner's preferred phrase for the name's idea.

**Rejected.**

- "HQ" as the word in the copy — owner prefers "command center".
- "Run" as the verb for what githq lets you do with repositories — reads as hosting (owner).

## D6

The headline is superseded by [D7](#d7); the three sections stand.

**The landing page opens with "All your repositories in one place. No separate tracker.", followed by three
sections: everything that needs you from every repository; your tracker is already on GitHub, with the
comparison; even solo, you are leading a team.** (2026-11-02, owner)

**Why.** Of the three openings drawn in `githq.pen` (`LP1`–`LP3`), it is the one that puts both promises of
[D4](#d4) in the headline itself. The design agent's subhead drops Linear's name ("the issue tracker you would
pay for"), which [D2](#d2) allows: Linear stays in the comparison.

**Rejected.**

- "The command center for all your repositories." (`LP2`) — "command center" promises little until the line
  under it is read; kept for one-line places such as the share image (owner chose `LP1`).
- "Ten repositories. One place to manage them." (`LP3`) — someone with two repositories may feel it is not for
  them (owner chose `LP1`).

## D7

**The landing page opens with "All your repos at the speed of thought".** (2026-11-05, owner) The subhead stays and carries "no
separate tracker" on its own, so [D4](#d4)'s two promises still come together, in the first two lines rather than in the headline.
The page's title and the README follow it; the footer's tagline keeps "All your repositories in one place."
([D35](../githq/DECISIONS.md#d35), `githq.pen`).

**Rejected.**

- "All your repositories in one place. No separate tracker." ([D6](#d6)) as the headline: the owner chose the new one.

## D8

**Below the hero, the page and `githq.pen` tell one story: all your repositories in one place first, with agents as the
reason, then no separate tracker, then why now; code review gets a section of its own; the desktop app replaces any
mention of pinning the website.** (2026-11-05, owner)

**Why.** Owner: "what is deployed is better than the design", and the first section has to say that githq manages all
your projects, of which you have many, above all when working with agents. The hero no longer says "one place", so
this section does. Reviews and merging are built, so nothing may send a reader to github.com for them.

**Rejected.**

- "Everything that needs you, from every repository." as the title — reads oddly, "like Yoda" (owner).
- "Not another tracker. A faster way to work the one you already have." as the first section — sells only a tracker
  (owner).
- Code review as a card in the details — it is too strong an argument for a card (owner).
- The address bar in the hero, with the screenshot moving under it — dropped by the owner. The loop stays in the "Swap
  the host" card.

**Kept.** The hero's screenshot still rises in once as the page opens (dimmed and 16 px lower at first, 320 ms), without
the address bar: with no motion at all the hero looked flat (owner). Under reduced motion it stands in place.
