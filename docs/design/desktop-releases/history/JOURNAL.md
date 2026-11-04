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
- 2026-11-04: Owner: summary by a local agent through a repo skill like `release` (D6); a toast in a corner after an update
  (D7); builds are not decided by title scopes, the app is one SPA (D4 sharpened, evidence #96 mislabelled). Owner asked why
  not a separate release channel, and whether to have three: Stable, Nightly, Development. Put to the owner: GitHub has no
  channels; keep two for now, or Nightly as a daily copy of a Development build; drop the scopes. Unanswered, as are where
  the app reads changes from and the Apple account. Raised: four-hour checks contradict "shortly after a merge".
- 2026-11-04: Owner: keep the scopes on `feat` and `fix`, sharpen them, no `chore` (D8). Owner's reason, that `chore` might skip
  a deploy, checked and not so; told. Agent proposed a path check on scopes. Owner asked what replacing a release means:
  explained and folded into the story. Three channels, reading from GitHub, 15-minute checks, Apple account: unanswered.
- 2026-11-04: Owner accepted: path check on scopes (D8), two streams with no Nightly (D9), reading what changed from GitHub
  (D10), 15-minute and 4-hour checks with "check now" (D11), personal Apple account (D2). Story folded up to here. Next:
  failure sweep and rightsize before proposing to close.
- 2026-11-04: Failure sweep and three rightsize passes back, nothing applied yet. Dropped as already chosen by the owner with the
  simpler version in view: waiting instead of downgrading (D5), link to the browser instead of an in-app list (D3), definition
  only for scopes (D8), a skill for the summary (D6), Windows on Development (D2). Put to the owner: one release read for the list
  on both streams; last stable patch + 1 as the version base; publish a draft and replace instead of swapping files, tag not moved;
  no "check now"; second app kept out. From the sweep, proposed: a newer push cancels an older build; a running `-dev` build on
  Stable accepts any stable version (no one-off state) and switching checks at once; the list is fetched on click, a failure
  gives a link. Proposed to accept: a platform missing from a hand-published draft; never reusing a published version. Corrected
  "about 9 minutes": measured without notarization. Risks raised: `.deb` update needs privilege in the background, updater key
  backup. Proposed order: Development, what changed, then signature and 0.1.0.
- 2026-11-04: Owner on rightsize: keep the two sources for what changed (D10); version is the next minor of the last stable, not
  predicted from titles (D4, old form in history); draft then replace, tag not moved (D4); keep "check now", useful later (D11).
  Separate app not pursued. Still unconfirmed: the sweep's rules (marked in D4, D5, D10), the two accepted cases, the order, whether
  the updater key is backed up. Not checked: a draft holding a tag a published release holds. Story folded up to here.
- 2026-11-04: Owner accepted the sweep's three rules (D4, D5, D10), the two cases without code (D12), the order (D13). Owner asked
  what the updater key is: explained. Backup still to be settled. Story folded.
- 2026-11-04: Updater key and password stored in Bitwarden through a temporary mapping, compared with the files without showing
  them; not mapped in the repo so development doesn't load them (`docs/desktop/RELEASING.md`). Owner closed the design. Goes to
  `/dev:deliver`.
- 2026-11-04: Owner reopened the key's backup: scripts must read it from the store, independent of the machine (D14). Mapped prod
  only, `build:desktop:signed` added and tried, procedure in `docs/desktop/RELEASING.md`. Asked: CI through repository secrets or
  through the store; whether to delete `~/.githq-secrets`.
- 2026-11-04: Owner: what runs on GitHub reads GitHub secrets, Bitwarden only manages them (D14). `~/.githq-secrets/updater.key` and its
  password deleted after one more comparison with the store. The secret-store change split into its own pull request, because a
  `docs` pull request can't touch code.
- 2026-11-04: Update screens drawn in `githq.pen` (frame "Desktop · Updates", U3–U40). Owner decided along the way: a fresh install
  starts on Stable (D15), Linux installs on Restart (D16). Drawing it raised U19: a fresh Development build takes the older Stable at
  its first check. Also seen: GitHub's compare call does page (`compare/1e38779...632d28b?per_page=2&page=2` returned 2 of 69), which D3
  says it doesn't; past 250 not tried, so U32 is drawn as asked.
- 2026-11-04: U19 settled by the owner: a fresh Development build starts on Development (D15 rewritten; the first form rejected in it).
- 2026-11-04: Owner rejected all three surfaces for what changed: a Changelog section in Settings, every version in its own fold, no ranges (D17). Asked: one fold for Development, or one per build (U43).
- 2026-11-04: Owner: the commands for updating, restarting and so on belong in the command menu (D18).
- 2026-11-04: Owner accepted one fold for Development (U43, D17).
