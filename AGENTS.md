# githq

A fast, keyboard-first command center for GitHub Issues, Projects, pull requests and Actions across every repository:
Linear-grade ergonomics with GitHub as the only backend. Positioning: `docs/design/positioning/`.

## Product principles

- GitHub is the source of truth. No server of our own for task data; anything stored locally is a rebuildable cache.
- Snappy: optimistic updates, background-synced local cache, no spinner on navigation. A slow screen is a bug.
- Keyboard-first: command palette, single-key shortcuts, everything reachable without the mouse.
- Calm, minimal UI: dense readable lists, few colors, no chrome that doesn't earn its place.
- Map onto GitHub concepts (issues, labels, milestones, Projects v2 fields, views, iterations); don't invent parallel ones.
- API: GraphQL first, REST only where GraphQL can't, REST conditional requests (304s) for change detection, degrade
  gracefully on rate limits. No webhooks.

## Architecture and design

- `ARCHITECTURE.md`: read before changing the layout, tooling or a package's role.
- Stack: bun workspaces + Nx, nzyme as a submodule (`nzyme/`, deps `workspace:*`), Nuxt 4 SPA, one Cloudflare Worker
  (SPA + OAuth token exchange), IndexedDB-backed in-memory store, GitHub GraphQL via graphql-codegen
  (`docs/design/githq/DECISIONS.md` D16–D19).
- Exception to the SPA: `/` is prerendered signed out into `_landing.html` (`index.html` stays the shell). The Worker
  serves the shell when the cookie `githq_signed_in=1` is set (written only by `AuthStore`), the landing otherwise.
  `nuxt dev` never server-renders. See `docs/decisions/prerendered-landing-and-signed-in-hint.md`.
- Designs live in `docs/design/<slug>/`; the main one is `githq/` (start at `README.md`). Before changing `githq.pen`,
  follow `DESIGN.md`; for a design changelog, follow its "Implementing from a changelog".
- A prompt for the design agent goes inline in the reply as one copyable block, never a file. Point it at `ui/` and
  `DESIGN.md` instead of repeating them.

## Commands

From the repo root; the check order is in the `verify` skill.

- `bun run setup`: install, build, codegen, prepare Nuxt.
- `bun run dev`: app on :8787, Worker on :8788 behind `/api/**`. Real sign-in needs `GITHUB_CLIENT_SECRET`
  (`secrets` skill); without it, use the dev-only token form (`gh auth token`).
- `bun run preview`: production shape (built SPA + Worker in `wrangler dev` on :8787).
- `bun run deploy`: manual deploy; every push to `main` deploys after the checks.
- `bun run dev:desktop`, `build:desktop`, `build:desktop:signed`: Tauri app in `packages/desktop` (needs Rust).
  Releases: `release` skill.
- `bun run codegen`: translations, tsconfigs, GraphQL SDK; `bun --cwd packages/github schema` refreshes the schema.
- `bun run tests`, `test:stories`, `e2e`: bun tests, Storybook tests, Playwright against a mocked GitHub.
- `bun run lint`, `format` (Markdown too), `format:md`.
- `bun run index`: regenerate the gitignored `INDEX.md` / `UTILS.md` code map.
- `bun run lighthouse [url]`.

## How we work

- Talk to the owner in Polish. Everything in the repo or on GitHub is in English (code, docs, commits, PRs, issues).
- Greenfield: no backwards compatibility, no migrating or cleaning up old local data, storage keys or addresses.
- Every implementation task loads the `code-conventions` skill with the Skill tool, plus the skill for its area. Each
  inlines nzyme's practice document only when loaded, so load it, don't Read the file; a rule that is wrong everywhere
  is fixed in nzyme.
- Work inside `nzyme/` follows `nzyme/CLAUDE.md`. Sessions start at the repo root: the repo skills inline
  `nzyme/docs/practice/*.md` by a path relative to it, and fail to load from a subdirectory.
- Don't install `nzyme@nzyme` from the marketplace (it shadows the submodule's skills). Change shared skills in
  kedrzu/skills, not here.

## Git and pull requests

Commands for every step: `git-workflow` skill. One task = one Paseo worktree = one branch = one PR.

Without asking:

- Once the task is known: name the branch and workspace, open a draft PR before any work.
- End of every turn that changed files: commit, merge `main`, push, update the PR description if the scope grew, end
  with the PR link.
- Merge `main`, never rebase or force-push; resolve conflicts yourself.
- When finished (full `verify` green, pushed, description current): `gh pr ready`, then take the PR to green.

Only on the owner's word ("mergujemy", "merge it"): squash merge. Never push to `main`. Skip the commit/PR only when
told to or for a throwaway experiment.
