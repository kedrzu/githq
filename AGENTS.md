# githq

All your repositories in one place, no separate tracker: a fast, keyboard-first command center for GitHub Issues, Projects, pull requests and Actions across every repository — the Linear experience, free, with GitHub as the only backend. How we describe it: `docs/design/positioning/`.

## What this is

- A client, not a new tracker: issues, labels, assignees, milestones and Projects (v2) fields, views and iterations are the data model. GitHub is the source of truth; we never keep task data anywhere GitHub can't see it.
- No server of our own for task data. Anything we store locally is a cache that can be rebuilt from GitHub.
- Target user: individuals and small teams who already live on GitHub and want Linear-grade speed and ergonomics without paying for or syncing to a second tool.

## Product principles

- **Snappy above all.** Every interaction should feel instant: optimistic updates, a local cache synced in the background, no spinner on navigation. A slow screen is a bug.
- **Keyboard-first.** Command palette, single-key shortcuts, everything reachable without the mouse.
- **Calm, minimal UI.** Dense but readable lists, few colors, no chrome that doesn't earn its place.
- **Faithful to GitHub.** Map onto GitHub concepts rather than inventing parallel ones, so changes made here and on github.com stay consistent in both directions.
- **Respect API limits.** GraphQL for fetching and writing whenever it can do the job, REST where it can't, REST conditional requests (free 304s) for change detection, and degrade gracefully on rate limits. No webhooks: there is no server to receive them.

## Architecture

How the repo is built and why: `ARCHITECTURE.md`. Read it before changing the layout, tooling or a package's role.

## Status

Being built (issue #4, `/dev:deliver`). The design is `docs/design/githq/` (start at its `README.md`; decisions in `DECISIONS.md`, UI briefs in `ui/`, mockups in `githq.pen`). Merging pull requests has its own design, `docs/design/pr-merge/`. So do stacked pull requests, `docs/design/stacked-prs/`. So do commit history and the git client, `docs/design/git-client/`. So do desktop releases and update streams, `docs/design/desktop-releases/`. So does githq on a phone, `docs/design/mobile/`.

## Stack & commands

Chosen: bun workspaces + Nx, nzyme as a git submodule (`nzyme/`, deps as `workspace:*`), Nuxt 4 SPA (`ssr: false`, static build), one Cloudflare Worker serving the SPA and the OAuth token exchange, IndexedDB-backed in-memory store, GitHub GraphQL via graphql-codegen. Details: `docs/design/githq/DECISIONS.md` D16–D19.

One exception to the SPA: `/` is prerendered signed out into `_landing.html` (Nuxt hybrid; `index.html` stays the shell, both build checks assert it), and the Worker also runs for `/` and `/_landing`, serving the shell to a browser with the signed-in hint cookie `githq_signed_in=1` (written only by `AuthStore`) and the landing to everyone else. `nuxt dev` never server-renders. Why: `docs/decisions/prerendered-landing-and-signed-in-hint.md`.

Commands (from the repo root; checks and their order are in the `verify` skill):

- `bun run setup` — install, build nzyme's CLI, generate tsconfigs and translations, build, prepare Nuxt.
- `bun run dev` — the app on http://localhost:8787 (`nuxt dev`) with the Worker on 8788 behind `/api/**`.
  Real "Sign in with GitHub" needs `GITHUB_CLIENT_SECRET` of the OAuth App "githq (dev)"
  (callback `http://localhost:8787/auth/callback`), from Bitwarden after `bun nzyme secrets login` (`secrets` skill)
  or from a root `.env`, which wins while it exists and which `setup.sh` copies from the main checkout;
  without either, the dev-only token form on the sign-in screen takes a token (`gh auth token`).
- `bun run preview` — the production shape: the built SPA and the Worker in one `wrangler dev` on 8787.
- `bun run deploy` — build the SPA and deploy both Workers by hand: `githq` on https://githq.dev and
  `githq-www` redirecting www (Cloudflare account of kedrzu@gmail.com; the OAuth App "githq" credentials are
  Worker secrets). Every push to `main` deploys by itself once the checks pass (`.github/workflows/deploy.yml`).
- `bun run dev:desktop` — the Tauri desktop app (`packages/desktop`, D23) against `nuxt dev`; sign-in uses the
  Device Flow of "githq (dev)", which needs no secret (`GITHQ_ENV` picks the app; Device Flow enabled). Needs Rust.
- `bun run build:desktop` — a local desktop installer (unsigned, no updater key needed).
- `bun run build:desktop:signed` — the same with signed updater bundles, the key read from the secret store on any machine after `bun nzyme secrets login`.
- Desktop releases: the manually dispatched action `release.yml` (`gh workflow run release.yml -f mode=preview|stable`)
  works out the version from PR titles, tags `main` and fills a draft release. The owner's word to release covers
  everything through publishing: the `release` skill does it all and asks only about what really needs them.
  Every push to `main` also builds the Development stream (`development.yml`).
  Steps and one-time setup: `docs/desktop/RELEASING.md`.
- `bun run codegen` — translations, tsconfigs, and the GitHub GraphQL SDK from `packages/github/src/operations/*.gql`
  (`bun --cwd packages/github schema` refreshes GitHub's schema).
- `bun run tests`, `bun run test:stories`, `bun run e2e` — bun tests, Storybook component tests, Playwright
  against a mocked GitHub.
- `bun run lint`, `bun run format` (both also format Markdown, through ESLint); `bun run format:md` for Markdown alone.
- `bun run index` — the gitignored code map (`INDEX.md`, `UTILS.md`), also run by setup.
- `bun run lighthouse [url]` — Lighthouse with PageSpeed Insights' settings (mobile and desktop, medians of 3 runs);
  by default against `bun run preview` on 8787, or e.g. `https://githq.dev/`.

`zsh setup.sh` prepares a checkout or worktree (Paseo runs it via `paseo.json`); until the first package exists it does no build.

## How we work

- Talk to the owner in **Polish**, plainly — but only in the conversation with the agent. Everything that
  lands in the repo or on GitHub is in **English**: code, names in code, comments, docs and design documents,
  commit messages, branch names, PR titles and descriptions, issues and their comments, review comments.
  When a document quotes the owner, translate the quote.
- Greenfield: no backwards compatibility yet. Don't migrate or clean up old local data, storage keys or
  addresses, and don't propose it.

## Design

Before changing the design file (`githq.pen`), read and follow `DESIGN.md`, in whichever client you run. When told
that a design changelog is on a worktree, read `.context/design/` there and follow "Implementing from a changelog"
in `DESIGN.md`.

When the owner asks for a prompt for the design agent, give it inline in your reply, as one block to copy, never as
a file in the repo (no `design-agent-prompt.md`). Point it at the briefs in `ui/` and at `DESIGN.md` instead of
repeating them.

## Worktrees and pull requests

Work happens in Paseo worktrees, several at once: one task = one worktree = one branch = one PR. When Paseo
creates a worktree it runs `setup.sh` (`paseo.json`): it merges `origin/main` into the new branch,
fast-forwards the local `main`, copies files that live outside git from the main checkout (`CLAUDE.local.md`,
`.claude/settings.local.json`, `.env*`, `packages/*/.dev.vars`) and checks out the pinned nzyme.

**Without asking** (standing permission): once the task is known, name the branch and the workspace and open the PR
as a draft, before any work on it; at the end of every turn that changed files — commit, catch up with `main`, push,
and update the PR's description when the scope grew. Keep the branch current with `main` by merging,
never rebase or force-push; resolve conflicts yourself. End with the PR link. PR titles are Conventional
Commits (`feat: …`, `fix(web): …`): see the `git-workflow` skill.

**Drafts.** A PR stays a draft until its work is finished, because the checks (`.github/workflows/pr.yml`) run on every
push to a PR that is ready. Pushing to a draft mid-work is fine, and a turn that ends with work left or a question for
the owner leaves it a draft. Finished means the task is done, the full `verify` is green, everything is pushed and the
description is current; `gh pr ready` follows, done without asking. The agent then takes the PR to green
(`git-workflow` → Green), so that the owner can merge it by hand; a failure the PR did not cause gets a tracked issue and
a fixer agent of its own. A follow-up on a ready PR: finished within one turn, push it once verified, the PR stays ready
and the checks restart; longer than that, `gh pr ready --undo` first and `gh pr ready` again at the end. It too ends green.

**Only on the owner's word** ("mergujemy", "merge it"): the squash merge, of a stack too. Never push to `main` — the `git`
plugin's hook blocks it (`.claude/git.json`). Skip the commit and PR only when told not to commit, or for an
explicit throwaway experiment.

The commands for every step are in the `git-workflow` skill (`.claude/skills/git-workflow/`).

## Agent skills

Plugins come from the `kedrzu-skills` marketplace (https://github.com/kedrzu/skills) and are enabled in `.claude/settings.json`: `dev`, `git`, `playwright`, `web-search`, `guardrails`, `handoff`, `retro`, `skill-improve`, plus `skill-creator` and `claude-md-management` from `claude-plugins-official`. Run `claude plugin install <plugin>@<marketplace>` once per plugin on a new machine. Change skills in the kedrzu/skills repo, not here.

nzyme's skills load from the submodule through the symlink `.claude/skills/nzyme` → `../../nzyme/plugins/nzyme`, so they always match the pinned nzyme commit (don't also install `nzyme@nzyme` from its marketplace — it would shadow them). Every implementation task reads `nzyme:code-conventions` plus the skill for the nzyme package it touches. Work inside `nzyme/` follows `nzyme/CLAUDE.md` (Conventional Commits, PR to `kedrzu/nzyme`).
