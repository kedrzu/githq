# githq

A fast, keyboard-first task manager on top of GitHub Issues and GitHub Projects — the Linear experience, free, with GitHub as the only backend.

## What this is

- A client, not a new tracker: issues, labels, assignees, milestones and Projects (v2) fields, views and iterations are the data model. GitHub is the source of truth; we never keep task data anywhere GitHub can't see it.
- No server of our own for task data. Anything we store locally is a cache that can be rebuilt from GitHub.
- Target user: individuals and small teams who already live on GitHub and want Linear-grade speed and ergonomics without paying for or syncing to a second tool.

## Product principles

- **Snappy above all.** Every interaction should feel instant: optimistic updates, a local cache synced in the background, no spinner on navigation. A slow screen is a bug.
- **Keyboard-first.** Command palette, single-key shortcuts, everything reachable without the mouse.
- **Calm, minimal UI.** Dense but readable lists, few colors, no chrome that doesn't earn its place.
- **Faithful to GitHub.** Map onto GitHub concepts rather than inventing parallel ones, so changes made here and on github.com stay consistent in both directions.
- **Respect API limits.** GraphQL for fetching and writing, REST conditional requests (free 304s) for change detection, and degrade gracefully on rate limits. No webhooks: there is no server to receive them.

## Status

Designed, not yet built. The design is `docs/design/githq/` (start at its `README.md`; decisions in `DECISIONS.md`, UI briefs in `ui/`, mockups in `githq.pen`). Build it with `/dev:deliver` on that folder, following the "Order of building" in its README.

## Stack & commands

Chosen, replicating the author's Cookery app (`~/Dev/cook-app`): bun workspaces + Nx, nzyme as a git submodule (`nzyme/`, deps as `workspace:*`), Nuxt 4 SPA (`ssr: false`, static build), one Cloudflare Worker serving the SPA and the OAuth token exchange, IndexedDB-backed in-memory store, GitHub GraphQL via graphql-codegen (pattern of `healedcare/healed` `packages/healthie`). Details: `docs/design/githq/DECISIONS.md` D16–D19.

Commands: TODO — the first build step creates the workspace; then run `/dev:setup` to write the project's `verify` skill and fill this section (`git-workflow` already exists).

`zsh setup.sh` prepares a checkout or worktree (Paseo runs it via `paseo.json`); until the first package exists it does no build.

## How we work

- Talk to the owner in **Polish**, plainly. Code, names in code, commit messages and PR titles in English; PR
  descriptions and issue comments in Polish. Design documents in `docs/design/` are in English.

## Worktrees and pull requests

Work happens in Paseo worktrees, several at once: one task = one worktree = one branch = one PR. When Paseo
creates a worktree it runs `setup.sh` (`paseo.json`): it merges `origin/main` into the new branch,
fast-forwards the local `main`, copies files that live outside git from the main checkout (`CLAUDE.local.md`,
`.claude/settings.local.json`, `.env*`, `packages/*/.dev.vars`) and checks out the pinned nzyme.

**Without asking** (standing permission): name the branch and the workspace once the task is known; at the
end of every turn that changed files — commit, catch up with `main`, push, then open the PR (ready for review,
not a draft) or update its description when the scope grew. Keep the branch current with `main` by merging,
never rebase or force-push; resolve conflicts yourself. End with the PR link.

**Only on the owner's word** ("mergujemy", "merge it"): the squash merge. Never push to `main` — the `git`
plugin's hook blocks it (`.claude/git.json`). Skip the commit and PR only when told not to commit, or for an
explicit throwaway experiment.

The commands for every step are in the `git-workflow` skill (`.claude/skills/git-workflow/`).

## Agent skills

Plugins come from the `kedrzu-skills` marketplace (https://github.com/kedrzu/skills) and are enabled in `.claude/settings.json`: `dev`, `design-doc`, `git`, `playwright`, `web-search`, `naming`, `guardrails`, `secrets`, `skill-improve`, plus `skill-creator` and `claude-md-management` from `claude-plugins-official`. Run `claude plugin install <plugin>@<marketplace>` once per plugin on a new machine. Change skills in the kedrzu/skills repo, not here.

nzyme's skills load from the submodule through the symlink `.claude/skills/nzyme` → `../../nzyme/plugins/nzyme`, so they always match the pinned nzyme commit (don't also install `nzyme@nzyme` from its marketplace — it would shadow them). Every implementation task reads `nzyme:code-conventions` plus the skill for the nzyme package it touches. Work inside `nzyme/` follows `nzyme/AGENTS.md` (Conventional Commits, PR to `kedrzu/nzyme`).
