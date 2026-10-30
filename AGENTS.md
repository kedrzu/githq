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

Commands: TODO — the first build step creates the workspace; then run `/dev:setup` to write the project's `verify` and `git-workflow` skills and fill this section.

`zsh setup.sh` prepares a checkout or worktree (Paseo runs it via `paseo.json`); today it only initialises the nzyme submodule.

## Agent skills

Plugins come from the `kedrzu-skills` marketplace (https://github.com/kedrzu/skills) and are enabled in `.claude/settings.json`: `dev`, `design-doc`, `git`, `playwright`, `web-search`, `naming`, `guardrails`, `secrets`, `skill-improve`, plus `skill-creator` and `claude-md-management` from `claude-plugins-official`. Run `claude plugin install <plugin>@<marketplace>` once per plugin on a new machine. Change skills in the kedrzu/skills repo, not here.

nzyme's skills load from the submodule through the symlink `.claude/skills/nzyme` → `../../nzyme/plugins/nzyme`, so they always match the pinned nzyme commit (don't also install `nzyme@nzyme` from its marketplace — it would shadow them). Every implementation task reads `nzyme:code-conventions` plus the skill for the nzyme package it touches. Work inside `nzyme/` follows `nzyme/AGENTS.md` (Conventional Commits, PR to `kedrzu/nzyme`).
