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

