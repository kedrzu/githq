# githq

A fast, keyboard-first task manager on top of GitHub Issues and GitHub Projects. Think Linear, but free and backed entirely by GitHub.

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
