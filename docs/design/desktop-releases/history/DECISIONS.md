# Retired decisions

Each retired form in full, under its original ID, oldest first. Never edited after it is written.

## D2

Retired 2026-11-04, replaced by the current [D2](../DECISIONS.md#d2).

**macOS and Linux first; Windows once it can be signed.** (2026-11-04, owner)

**Why.** The owner gave the order, not the reason. Inferred by the design agent, unconfirmed: the unsigned Windows
experience is the obstacle (SmartScreen warnings; Smart App Control blocks unsigned apps outright, per the root
`README.md`). The evidence is unchanged and stays with the current form.

## D4

Retired 2026-11-04, replaced by the current [D4](../DECISIONS.md#d4).

**A Development build is made on every push to `main` that passes the checks, for macOS and Linux, and lives in one
moving prerelease on GitHub that each build replaces. The `candidate` release mode goes away.** (2026-11-04, owner)

**Why.** The owner wants to test what was just merged, so the clock is the wrong trigger, and a full build is about 9
minutes and free (evidence under [D1](#d1)). One moving release keeps the Releases page readable and gives the updater a
fixed manifest URL. Development does what the release candidate was for. Accepted: yesterday's build is gone, so a broken
build is fixed by the next one or left by switching to Stable.

A push is skipped only when it changes documentation alone, read from its paths (`hasNoCode`,
`packages/app/scripts/releasePlan.ts:80`), never from its title (owner, 2026-11-04): the app is the same SPA in a Tauri
wrapper, so a title can't be trusted to say what reached it.

> **Checked 2026-11-04:** titles do mislabel this. `fix(web): grow the track pickers with the window's height` (#96) is one
> of the four scoped commits on `main`; the scope rule is in `.claude/skills/git-workflow/SKILL.md`, and `checkTitle` compares
> no scope with any path (`packages/app/scripts/releasePlan.ts:56`).

Proposed by the design agent; explained to the owner, who raised no objection: the version is the next stable version plus `-dev.N`, with N the commit
count on `main`, which only ever grows; the moving tag is `development`, outside the `v*` tags the version is computed
from; no ruleset covers tags, so an Action may move it.

**Rejected.**

- A build once a night: a merge would wait until the next day to be tried, and the name would have to be earned by a
  schedule nobody needs.
- A release per build: per-build history and rollback, at the cost of hundreds of prereleases to prune and a separate
  pointer release still needed for the fixed manifest URL.
- The name "nightly": these builds don't come nightly.

## D13

**Work goes in this order: the Development stream and its choice in Settings; what changed and the toast; then the Apple
signature and the first Stable, 0.1.0.** (2026-11-04, owner) Retired when delivery began: the order was delivery's to keep, and the Apple
signature was done first after all. Its dependency, that the toast needs a recorded last-run version, moved to D7.
