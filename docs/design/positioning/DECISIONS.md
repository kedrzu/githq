# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D1

**githq leads with being an issue tracker.** (2026-11-02, owner)

**Why.** Owner: nearly everyone wants to track what happens in their projects, existing tools are paid or need
self-hosting, and GitHub is simply there. A need people already know they have sells better than a better way
to browse GitHub, which people feel only after using it.

> **Checked 2026-11-02:** "existing tools are paid" holds only past a free tier. Linear's free plan is
> reported as 250 issues and two teams with unlimited members, then $10 per user per month billed yearly
> (secondary sources, e.g. [omidsaffari.com](https://omidsaffari.com/blog/linear-pricing); linear.app/pricing
> did not render for the fetcher, so not confirmed first-hand). Plane's free cloud plan allows 12 users
> ([plane.so/pricing](https://plane.so/pricing)); it is open source and self-hostable. So the honest claim is
> "a second tool, a sync, and a bill once you grow", not "everything else costs money".

**Rejected.**
- "Everything for GitHub in one place" as the headline — it names no need; nobody feels that browsing GitHub
  could be better until they have used githq (owner).

## D2

**The comparison with Linear stays, as what githq replaces.** (2026-11-02, owner)

**Why.** It tells a reader what kind of tool this is and what it saves them, in one name.

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
