<div align="center">

<a href="https://githq.dev"><img src="docs/assets/readme/wordmark.svg" alt="githq" height="80"></a>

A keyboard-first client for GitHub Issues, pull requests and Projects.

[githq.dev](https://githq.dev) · [Design](docs/design/githq/README.md) · [Issues](https://github.com/kedrzu/githq/issues)

[![Deploy](https://img.shields.io/github/actions/workflow/status/kedrzu/githq/deploy.yml?branch=main&style=flat-square&label=deploy)](https://github.com/kedrzu/githq/actions/workflows/deploy.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)

</div>

<img src="docs/assets/readme/my-work.png" alt="githq: My work across every repository, with an issue open in the side panel" width="100%">

## Why

GitHub is a fine place to keep issues: next to the code, open to contributors, free. It is a slow place to work
them. Every view is a page load, there is no single list of what concerns you across repositories, and the
mouse is never optional. The usual answer is a dedicated tracker, which means a second tool, a sync, and seats
to pay for.

githq is the other answer: a fast client for the tracker you already have. It shows what GitHub has and
nothing else, and every change you make is an ordinary GitHub change, visible on github.com at once.

## What it does

- **My work** — issues assigned to you, your pull requests with checks and reviews, reviews waiting on you and
  mentions, from every repository, including other people's.
- **Repositories and Projects** — tracked repositories and GitHub Projects as lists or boards, with the
  fields, views and iterations each project defines.
- **Keyboard first** — a command menu (<kbd>⌘</kbd> <kbd>K</kbd>) and single-key actions on the selected
  items.
- **Instant** — screens open from a copy in your browser; edits show at once and are written to GitHub behind
  the scenes.
- **Same addresses** — replace `github.com` with `githq.dev` in a link to an issue, pull request or list.

There is more on [githq.dev](https://githq.dev).

## How it works

githq is a single-page app that talks to GitHub's GraphQL API straight from your browser. What you work on is
kept in IndexedDB as a cache that can always be rebuilt from GitHub; tracked repositories and projects are
refreshed with conditional REST requests, which cost nothing from your rate limit when nothing changed.

The app is static files on Cloudflare. The only code that runs on a server is one stateless Worker that trades
GitHub's OAuth code for a token, because GitHub's token endpoint needs the client secret. It has no database and never sees your
issues. The design and every decision behind it, with the evidence, are in
[`docs/design/githq/`](docs/design/githq/README.md) and [`DECISIONS.md`](docs/design/githq/DECISIONS.md).

## Permissions and privacy

githq is a GitHub OAuth App. It asks for three scopes and needs all of them:

- `repo` — read and edit issues and pull requests, private ones included. GitHub has no narrower scope for
  that, so the consent screen reads as full repository access; githq touches only issues, pull requests and
  projects.
- `project` — read and edit GitHub Projects.
- `read:org` — list your organizations, to filter by owner and to tell which one hides its private data.

Your token stays in your browser's `localStorage`, and your data goes from the browser to `api.github.com`.
The Worker handles the code and the token in memory during sign-in, stores nothing and logs neither;
Cloudflare's own request logs still record that a request happened. The app has no analytics. You can revoke
access at any time under GitHub → Settings → Applications → Authorized OAuth Apps. An organization that
restricts OAuth Apps keeps its private repositories hidden until an owner approves githq.

## Status

githq is young and moving fast. It is planned in the open in
[GitHub Issues](https://github.com/kedrzu/githq/issues) and worked from githq itself. Expect rough edges, and
please report them.

## Development

A Nuxt 4 single-page app and one Cloudflare Worker, on bun workspaces and Nx.

```sh
bun run setup   # install, generate, build
bun run dev     # the app on http://localhost:8787
```

Without OAuth credentials in `.env` (template: `.env.example`), the sign-in screen of a development build
takes a personal token — `gh auth token` works. The rest of the commands, the checks and how we work are in
[`AGENTS.md`](AGENTS.md).

## Security

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/kedrzu/githq/security/advisories/new), not in
public issues.

Use it in the browser at [githq.dev](https://githq.dev), or install the desktop app.

## Desktop app

The desktop app is githq in its own window, with the app's files inside the installer. You sign in with a short
code that you enter on github.com, and GitHub hands the token straight to the app. The token stays in your
system's keychain. The app updates itself: a new version downloads in the background, and the status bar offers a
restart when it's ready.

**Download:** [the latest release](https://github.com/kedrzu/githq/releases/latest) on GitHub.

- **macOS** (Apple Silicon or Intel): the `.dmg` for your Mac. Until the app is signed with a Developer ID, macOS
  says it is from an unidentified developer. Open it once, then choose **Open Anyway** in System Settings →
  Privacy & Security. On macOS 14 and earlier, right-click the app and choose **Open** instead.
- **Windows** (x64): the `-setup.exe` installer. Builds are not signed yet, so SmartScreen warns about an
  unrecognised app: choose **More info → Run anyway**. With Smart App Control turned on, Windows 11 blocks unsigned
  apps outright, and the only way past it is turning Smart App Control off. Signed builds are planned (see below).
- **Linux** (x64): the `.AppImage`, which updates itself, or the `.deb` / `.rpm`, which don't: install a newer
  release by hand. The keychain is the Secret Service (GNOME Keyring, KWallet). Without one, githq asks you to
  sign in at every launch.

**Uninstalling:** on macOS, move githq from Applications to the Bin. On Windows, use Settings → Apps → Installed
apps → githq → Uninstall. On Linux, delete the AppImage, or remove the package (`sudo apt remove githq`,
`sudo dnf remove githq`). Signing out first removes the token from your keychain. Otherwise, delete the
`dev.githq.desktop` entry from it yourself.

## Code signing policy

This policy covers the githq desktop app published on this repository's
[Releases](https://github.com/kedrzu/githq/releases).

**Signing status.** Windows builds are not signed yet. The project plans to apply to the SignPath Foundation for
free code signing for open-source projects. macOS builds will be signed and notarized with the owner's Apple
Developer ID once it is set up. Until then they are ad-hoc signed, which identifies no publisher. Every build is
made by GitHub Actions on GitHub-hosted runners, from a version tag in this repository
([the release workflow](.github/workflows/release.yml)). Every release is published by hand after review.
Updates are signed with the project's updater key, and the app refuses an update whose signature doesn't verify.

**Team roles.**

- Authors and committers: [Michał Kędrzyński (kedrzu)](https://github.com/kedrzu), the repository owner and its
  only member with write access.
- Reviewers: [kedrzu](https://github.com/kedrzu). Every pull request from anyone else is reviewed before it is
  merged.
- Approvers: [kedrzu](https://github.com/kedrzu). Every release is approved before it is published or signed.

Members of these roles use multi-factor authentication on GitHub and on any signing service.

**Privacy.** The desktop app talks only to GitHub, and never to githq's own servers or anyone else's:

- `api.github.com`, for your issues, pull requests and projects, and for any change you make, on your behalf
  with your token;
- `github.com`, to sign in with a device code, and to check for and download updates from this repository's
  GitHub Releases;
- GitHub's image hosts (`avatars.githubusercontent.com` and other `*.githubusercontent.com` hosts), for avatars
  and images in issues.

Your token stays in your system's keychain. The copy of your GitHub data stays on your computer. Links you open
go to your own browser. githq collects no analytics or telemetry. What GitHub does with these requests is
covered by the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## License

Copyright 2026 Michał Kędrzyński.

githq is free software under the [GNU Affero General Public License v3.0](LICENSE): use it, change it and run it
for any purpose, commercial included. If you run a modified githq as a service for others, you must offer them
its source under the same license.

Want to use githq under different terms (for example inside a company whose policy rules out the AGPL)?
A commercial license is available: open an issue or write to the author.

The license covers the code only, not the githq name, logo or the githq.dev domain: a fork ships under its own name.

## Contributing

Contributions are welcome. Before your first pull request is merged you sign the
[Contributor License Agreement](CLA.md) by leaving a comment on the pull request; a bot asks for it. You keep
the copyright to your contribution; the agreement lets githq also offer it under the commercial license.

<br>

<div align="center"><sub>githq is not affiliated with GitHub, Inc.</sub></div>
