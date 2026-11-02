# Openings for the landing page

What a visitor to githq.dev sees before scrolling far. Every option carries both promises together: one place
to manage all your repositories, and no separate tracker for them because GitHub's issues and Projects are the
tracker ([why both](DECISIONS.md#d4)). Linear appears as what githq replaces, never as what it is
([why](DECISIONS.md#d2)).

The landing page has no analytics, so these cannot be measured against each other on the live site. Their use
is to be read to people and to watch which one makes them say "that's me".

## The headline and the line under it

**1. Command center.**
*The command center for all your repositories.*
Issues, pull requests, checks and deploys from every repository, on one fast, keyboard-first screen. Your
issues and Projects are the tracker — no Linear, no second tool to keep in sync.

Gives up: "command center" is a familiar phrase and promises little on its own; the line under it does the work.

**2. The reader counts their own repositories.**
*Ten repositories. One place to manage them.*
Hand out work in GitHub Issues, then see what came back — pull requests, failing checks, a deploy that broke
overnight — across every repository. It's all GitHub, so you don't need another tracker.

Gives up: someone with two repositories may feel it is not for them.

**3. Both promises in the headline.**
*All your repositories in one place. No separate tracker.*
githq puts GitHub Issues, Projects, pull requests and Actions from every repository on one fast screen. The
tracker you would pay Linear for is already in your GitHub.

Gives up: "no separate tracker" means little to someone who never had one.

## The sections under it, shared by all three

1. **Everything that needs you, from every repository.** Reviews waiting on you, your pull requests with their
   checks, workflows failing on `main`, the issues assigned to you — one list, every repository. The "one
   place" promise, shown.
2. **Your tracker is already on GitHub.** Issues, labels, Projects with their fields, boards and iterations,
   edited at once and visible on github.com the same second. Then the comparison: github.com, a dedicated
   tracker, githq. The "no separate tracker" promise, shown.
3. **Even solo, you are leading a team.** Agents opening pull requests in ten repositories while you hand out
   the next issue: githq is where you see what came back, review it and merge it.
   ([Why this is the reason now](DECISIONS.md#d3).)
