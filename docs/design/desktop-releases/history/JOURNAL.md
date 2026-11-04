# Journal

Append-only. One line per turn that settled something.

- 2026-11-04: Owner's brief: sign and ship the desktop app, macOS and Linux first, Windows once signed; explicit releases
  plus builds from `main`; channel chosen in Settings; changelog in the app after an update, from Conventional Commits,
  with an agent's plain-language summary for big releases only. Recorded as D1, D2, D3.
- 2026-11-04: Read the existing machinery (`release.yml`, `updater.rs`, `release.ts`, `RELEASING.md`): most of it is built,
  nothing is published. Checked Tauri, GitHub, Apple, SignPath and Azure; findings sit in `DECISIONS.md`. Clash raised with
  the owner: SignPath signs only what was already released unsigned, against "Windows once signed". Not yet answered.
- 2026-11-04: Put to the owner as proposals, unconfirmed: build on every push to `main` that passes the checks, not by the
  clock; one moving `nightly` release rather than a release per build; drop the `candidate` mode; switching to stable
  installs the older stable at once. README's opening is drafted from the brief; the owner has not reviewed it.
- 2026-11-04: Owner accepted all three proposals: Windows unsigned in Stable with a warning and no Development builds (D2
  rewritten, old form in history); Development on every passing push in one moving prerelease, `candidate` dropped, names
  Stable and Development (D4); switching to Stable installs it at once (D5). Owner will create the Apple Developer account;
  personal or company not answered. Agent's unconfirmed details sit in D4 and D5. Story folded up to here. Next: what changed.
