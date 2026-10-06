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
- **Respect API limits.** Prefer GraphQL, batch requests, use conditional requests/webhooks where possible, and degrade gracefully on rate limits.

## Status

Greenfield. No stack chosen yet — decide it (e.g. via `/design-doc`) before the first feature.

## Stack & commands

TODO: fill in once the stack is chosen. At that point run `/dev:setup` to write the project's `verify` and `git-workflow` skills.

## Agent skills

Plugins come from the `kedrzu-skills` marketplace (https://github.com/kedrzu/skills) and are enabled in `.claude/settings.json`: `dev` (with `design-doc`), `git`, `playwright`, `web-search`, `skill-improve`, `secrets`. Run `claude plugin install <plugin>@kedrzu-skills` once per plugin on a new machine. Change skills in the kedrzu/skills repo, not here.
