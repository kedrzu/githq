# Prompt for the design agent: three landing openings

Copy everything below the line into the design agent.

---

We're working on **githq** in `/Users/kedrzu/.paseo/worktrees/3kktpz0d/unruly-chicken/githq.pen`. Before
touching it, read and follow `DESIGN.md` in the same folder: screen codes, the amber `Variants · …` frame, and
the changelog (`.context/design/landing-openings.md` in that worktree).

## What this is about

githq.dev still introduces githq as "a keyboard-first task manager on top of GitHub Issues — Linear's speed,
GitHub's data". The product has grown past that: it merges pull requests, handles stacks of them, shows failing
GitHub Actions across repositories, and code review is coming. We are changing what the landing page says
githq is. The reasoning is in `docs/design/positioning/README.md`; the short version:

- **Two promises, always together.** githq is one place to manage all your repositories — issues, pull
  requests, checks and deploys from every repository on one screen — and because GitHub's issues and Projects
  are the tracker, you don't need a separate one. Neither half is shown alone.
- **Linear is what githq replaces, not what it is.** Never "Linear on GitHub".
- **Why now:** even a solo developer leads a team today, of agents opening pull requests in ten repositories.
  The issues are what you hand out; pull requests, checks and broken deploys are what comes back.
- **Words to avoid:** "run" for what you do with repositories (it reads as hosting), and "HQ" (say "command
  center").

## What to draw

Three variants of the top of the landing page, **desktop only**, in one amber frame
`Variants · How the landing page opens`. Start from the existing `Landing — …` frames and reuse their
components, type and spacing; this is a change of message, not a new visual style. Each variant is the hero
plus the three sections under it. Everything below those sections stays as it is today, so don't redraw it.

The headline and the line under it differ per variant. Use the copy as written; you may break lines, not reword.

**Variant A (recommended, the owner's favourite):**

- Headline: *All your repositories in one place. No separate tracker.*
- Under it: *githq puts GitHub Issues, Projects, pull requests and Actions from every repository on one fast
  screen. The tracker you would pay Linear for is already in your GitHub.*

**Variant B:**

- Headline: *The command center for all your repositories.*
- Under it: *Issues, pull requests, checks and deploys from every repository, on one fast, keyboard-first
  screen. Your issues and Projects are the tracker — no Linear, no second tool to keep in sync.*

**Variant C:**

- Headline: *Ten repositories. One place to manage them.*
- Under it: *Hand out work in GitHub Issues, then see what came back — pull requests, failing checks, a deploy
  that broke overnight — across every repository. It's all GitHub, so you don't need another tracker.*

**The hero picture**, the same in all three: the app showing both promises at once. My work across several
repositories — a review waiting, the user's pull requests with their checks, assigned issues — and in the
sidebar a repository with the red "something is broken" marker plus the cross-repository total of broken
workflows (the Workflows screens `W…` in the file have both). Repositories from different owners, so "every
repository" is visible.

**The three sections under the hero**, the same in all three variants; write the headings and a short body
in the tone of the current landing, and keep each to one picture or one table:

1. **Everything that needs you, from every repository.** Reviews waiting on you, your pull requests with their
   checks, workflows failing on `main`, the issues assigned to you — one list. Shows the "one place" promise.
2. **Your tracker is already on GitHub.** Issues, labels, Projects with their fields, boards and iterations;
   edits show at once and are on github.com the same second. Then the existing comparison table (github.com,
   a dedicated tracker, githq), with one row added: *Pull requests, checks and failing workflows next to your
   issues* — github.com: Partly (one repository at a time); a dedicated tracker: Partly; githq: Yes.
3. **Even solo, you are leading a team.** Agents opening pull requests in ten repositories while you hand out
   the next issue; githq is where you see what came back, and merge it. A picture of several agent-made pull
   requests across repositories, some green, one red.

The current landing has a detail card "Reviews stay where diffs belong — one key opens it on github.com". It is
below the part you redraw, but it contradicts where githq is going; flag it in your reply, don't change it.

## What I want back

- The three variants side by side in the amber frame, each screen titled `<code> · Variant A · …` per
  `DESIGN.md`; Variant A's caption says it is the recommended one.
- Anything in the copy that didn't fit or read badly in the layout — tell me rather than rewording it.
- The changelog entries.
