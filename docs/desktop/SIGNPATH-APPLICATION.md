# SignPath Foundation application

The answers for the form at [signpath.org/apply](https://signpath.org/apply.html), which asks for free Windows code
signing ([RELEASING.md](RELEASING.md#windows-signing-through-signpath-foundation-follow-up)). The form is a HubSpot
form; its fields as of 2026-11-18 are below, in order. Fields not listed (name, email, company, how we found
SignPath) are the owner's own.

## Project Name

githq

## Repository URL

https://github.com/kedrzu/githq

## Homepage URL

https://githq.dev

## Download URL

https://githq.dev/download

The form asks that this page mention SignPath Foundation. Its footer links the
[Code signing policy](https://github.com/kedrzu/githq#code-signing-policy), which does; the credit line "Free code
signing provided by SignPath.io, certificate by SignPath Foundation" is added there and to the Windows download once
the application is accepted.

## Privacy Policy URL

https://github.com/kedrzu/githq#code-signing-policy (the policy's **Privacy** and **Anonymous usage counts**
paragraphs; the full list of counted events is at
https://githq.dev/docs/how-it-works/privacy-and-permissions#usage-statistics)

## Tagline

A fast, keyboard-first command center for GitHub Issues, Projects, pull requests and Actions across every repository.

## Category

Developer tools (or the closest the list offers).

## Description

githq is a desktop and web client for GitHub that puts issues, Projects, pull requests and Actions from every
repository into one fast, keyboard-driven interface. GitHub is its only backend: the app talks to the GitHub API
directly with the user's own token, keeps a local cache of their data on their computer, and has no server of its own
for that data. It is built with Tauri and released for Windows, macOS and Linux from GitHub Actions; the macOS builds
are already signed and notarized.

## Reputation

The honest state: a young project (repository created October 2026), with public releases since v0.1.0 and about
120 installer downloads from GitHub Releases so far. Refresh the numbers before sending:

```bash
gh api repos/kedrzu/githq --jq '{stars: .stargazers_count, forks: .forks_count}'
gh api repos/kedrzu/githq/releases --jq '[.[].assets[].download_count] | add'
```

Add any coverage or discussion that exists by then.

## Maintainer Type

Individual.

## Build System

GitHub Actions. Every release is built on GitHub-hosted runners by
[`.github/workflows/release.yml`](../../.github/workflows/release.yml), from a version tag that workflow creates.

## Notes for the reviewers

The form has no field for these, so they go in the description or the reply to the first email.

**Licensing.** githq is AGPL-3.0 only. Contributors sign a CLA that would let the maintainer offer other terms; that
right is unused, no commercial or other license is offered, and none is planned.

**Privacy.** githq does not collect user data. The desktop app sends the user's data only to GitHub, on the user's
behalf. Its one other host is githq.dev, the project's own sign-in service, which the app needs to renew the GitHub
token (GitHub makes it expire after 8 hours) and to revoke it at sign-out. When it handles a renewal or a sign-out,
githq.dev adds one to an anonymous count of such events. A count holds only the event's name and that it came from
the desktop app: no GitHub login, token, IP address, device, country or anything about the user's repositories, and no
identifier of any kind, so it cannot tell one user from another. Nothing is sent for the count beyond the request the
app makes anyway. Users can turn it off in Settings → Privacy → Share usage statistics, and the app works the same
either way. This is described in the Code signing policy and, event by event, in the docs.

**Uninstalling.** The NSIS installer registers a standard uninstaller (Settings → Apps → Installed apps → githq →
Uninstall); the steps are in the docs
(https://githq.dev/docs/getting-started/sign-in-and-install#uninstalling).

**Team.** One maintainer, who is the author, reviewer and approver; MFA is on for GitHub and will be for SignPath.
