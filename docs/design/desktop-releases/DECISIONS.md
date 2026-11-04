# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D1

**One app with two update streams, Stable and Development (builds from `main`); the user picks one in Settings.** (2026-11-04, owner)

**Why.** Explicit releases are the official version; builds from `main` may have bugs and let the owner test merged
work in the installed app. Consequence accepted by choosing a setting rather than a second app: the two can't be
installed side by side on one machine.

> **Checked 2026-11-04:** the updater can take its endpoint at runtime: "Sets the endpoints to fetch the update manifest
> from, overriding the `endpoints` configuration value" —
> [UpdaterBuilder](https://docs.rs/tauri-plugin-updater/latest/tauri_plugin_updater/struct.UpdaterBuilder.html); the
> [plugin docs](https://v2.tauri.app/plugin/updater/) show this for separate release channels. Today the endpoint is
> fixed in `packages/desktop/src-tauri/tauri.conf.json:40` and the check is `app.updater()?.check()` in
> `packages/desktop/src-tauri/src/updater.rs:105`.

> **Checked 2026-11-04:** the default comparison is strictly greater by semver,
> `None => release.version > self.current_version` (tauri-plugin-updater 2.14.1 `updater.rs`, on docs.rs). A stable
> version lower than the installed build is never offered without a custom comparator: "To allow downgrades, you must
> use the updater builder's `version_comparator` API" — [plugin docs](https://v2.tauri.app/plugin/updater/). Whether any
> platform misbehaves applying a downgrade: searched, not found, not ruled out.

> **Checked 2026-11-04:** going back to an older build costs a first sync and nothing else: a local database of a newer
> githq is dropped and started again — `packages/app/store/IndexedDbPersistence.test.ts:81`.

> **Checked 2026-11-04:** the "latest" URL's stream is untouched by builds from `main` if those are prereleases. "The
> latest release is the most recent non-prerelease, non-draft release" —
> [REST docs](https://docs.github.com/en/rest/releases/releases#get-the-latest-release). The docs state this for the API;
> no page says it for the `releases/latest/download/` URL. Test it before relying on it.

> **Checked 2026-11-04:** a build costs nothing and takes minutes. "Use of the standard GitHub-hosted runners is free and
> unlimited on public repositories" — [GitHub docs](https://docs.github.com/en/actions/reference/runners/github-hosted-runners);
> the repository is public. The last full release run (41327591915, `v0.1.0-rc.1`, all four platforms) took 16:41:13 to
> 16:50:18, about 9 minutes. Windows was one of the parallel builds and among the slowest, finishing with Linux at 16:50:11. That run had no `APPLE_*` secrets, so it
> excludes signing and notarization, whose time is unmeasured; "about 9 minutes" is a lower bound for a signed build.

> **Checked 2026-11-04:** nothing is published: the repository has 0 releases and 0 tags
> (`gh api repos/kedrzu/githq/releases`, `…/tags`).

## D2

**macOS is signed and notarized, on an Apple Developer account the owner is creating; Linux needs no signature. Windows
ships in Stable releases only, as an unsigned download with an explicit warning, until a signature exists, and gets no
Development builds.** (2026-11-04, owner) The Apple account is personal, in the owner's name.

**Why.** Windows can't wait for the signature, because the free route signs only what was already released unsigned.
Stable is what SignPath would approve by hand; Development builds come too often for that. The updater's own key is
separate from any code-signing certificate, so an unsigned install keeps updating once signing starts.

**Rejected.**

- Holding Windows back until it is signed ([earlier form](history/DECISIONS.md#d2)): SignPath would have nothing released
  to sign. It would win through Azure Artifact Signing, which needs an organization.

> **Checked 2026-11-04:** SignPath Foundation requires the project to "already be released in the form that should be
> signed", wants "a certain verifiable reputation", and "Every release needs manual approval for signing" —
> [terms](https://signpath.org/terms.html). The terms don't define "release" or mention nightly builds; read as written,
> unattended signing of builds from `main` is not available.

> **Checked 2026-11-04:** Azure Artifact Signing: "Individual developers must be located in the United States or Canada";
> organizations are accepted in the EU, with validation of 1 to 20 business days, and it needs a paid Azure subscription —
> [quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart). Price: not found, the pricing page
> showed no figure to the fetch. Other free routes for open source: not searched.

> **Checked 2026-11-04:** Linux needs no signature to ship: "artifact signing is not required for your application to be
> deployed on Linux", and "AppImage does not validate the signature" —
> [Tauri docs](https://v2.tauri.app/distribute/sign/linux/). Updates are already protected by the updater's own signature
> (`docs/desktop/RELEASING.md`, "Updater key"), so "signing Linux" is no work.

> **Checked 2026-11-04:** the macOS signature is a paid account: "The Apple Developer Program annual fee is 99 USD" —
> [Apple](https://developer.apple.com/support/enrollment/). An individual enrolls under their personal legal name, an
> organization under its legal entity name with a D-U-N-S number; that page speaks of the App Store seller and does not
> say what Developer ID signing displays. "Only the Apple Developer `Account Holder` can create *Developer ID Application*
> certificates" — [Tauri docs](https://v2.tauri.app/distribute/sign/macos/). Enrollment time: not found. None of the
> `APPLE_*` secrets are set on the repository (`gh secret list`).

> **Checked 2026-11-04:** the plugin now updates more than the AppImage: "Updater plugin now supports all bundle types:
> Deb, Rpm and AppImage for Linux" — [updater v2.10.0](https://github.com/tauri-apps/plugins-workspace/releases/tag/updater-v2.10.0);
> the 2.14.1 source runs `dpkg -i`, which needs privilege. `README.md` and `release.yml:148` still say the `.deb` does not
> update. Not tried on a real install.

## D3

**After an update the app shows what changed. The formal list comes from Conventional Commits; the big releases also get
a plain-language summary of the most important changes, written by an agent; Development builds get the list only.**
(2026-11-04, owner)

**Why.** The formal list costs nothing, because the titles already carry it: `packages/app/scripts/releasePlan.ts:118`
renders the notes from them today. A summary is worth writing only for what comes rarely.

> **Checked 2026-11-04:** both sources the app could read are reachable. Listing releases: "Information about published
> releases are available to everyone. Only users with push access will receive listings for draft releases" — prereleases
> and sort order are not stated — [REST docs](https://docs.github.com/en/rest/releases/releases#list-releases); anonymous
> calls answer with `x-ratelimit-limit: 60` (`curl -I`). Comparing two commits: "the returned list is limited to 250
> commits" without paging — [REST docs](https://docs.github.com/en/rest/commits/commits#compare-two-commits); tried with
> `gh api repos/kedrzu/githq/compare/1e38779...632d28b`, which listed all 69 commits. `api.github.com` is already allowed by
> the desktop app's CSP (`packages/desktop/src-tauri/tauri.conf.json:24`).

## D4

**A Development build is made on every push to `main` that passes the checks, for macOS and Linux, and lives in one
moving prerelease on GitHub that each build replaces. The `candidate` release mode goes away.** (2026-11-04, owner)

**Why.** The owner wants to test what was just merged, so the clock is the wrong trigger, and a full build is about 9
minutes and free (evidence under [D1](#d1)). One moving release keeps the Releases page readable and gives the updater a
fixed manifest URL. Development does what the release candidate was for. Accepted: yesterday's build is gone, so a broken
build is fixed by the next one or left by switching to Stable.

A push is skipped only when it changes documentation alone, read from its paths (`hasNoCode`,
`packages/app/scripts/releasePlan.ts:80`), never from its title (owner, 2026-11-04): the app is the same SPA in a Tauri
wrapper, so a title can't be trusted to say what reached it.

> **Checked 2026-11-04:** titles do mislabel this. `fix(web): grow the track pickers with the window's height` (#96) is one
> of the four scoped commits on `main`; the scope rule is in `.claude/skills/git-workflow/SKILL.md`, and `checkTitle` compares
> no scope with any path (`packages/app/scripts/releasePlan.ts:56`).

The version is the last stable version with its minor raised, plus `-dev.N`, with N the commit count on `main`:
after `0.2.0`, `0.3.0-dev.214`; before any stable release, `0.1.0-dev.N` (owner, 2026-11-04). It reads no titles, always sorts
above the last stable and below the next minor, and it is the same whether the next stable turns out to be a patch or a minor.

A build makes a draft release, uploads to it and verifies its manifest, as a Stable release does; only then does it delete the
previous Development release and publish the draft under the same tag, `development`. The tag never moves; the commit is
named in the description. Accepted: for seconds a check can fail, and the updater retries at the next check. Not yet checked:
whether GitHub allows a draft with a tag that a published release holds; if not, the draft takes a temporary tag until
it is published.

Proposed by the design agent, accepted by the owner: a newer push cancels an older build still running, so an older build can't
overwrite a newer one, and the draft a cancelled build left is removed by the next.

**Rejected.**

- A build once a night: a merge would wait until the next day to be tried, and the name would have to be earned by a
  schedule nobody needs.
- A release per build: per-build history and rollback, at the cost of hundreds of prereleases to prune and a separate
  pointer release still needed for the fixed manifest URL.
- The name "nightly": these builds don't come nightly.
- The next stable version predicted from titles, `planRelease` plus `-dev.N` ([earlier form](history/DECISIONS.md#d4)): needs
  title parsing and a fallback for builds with nothing user-visible.
- Last stable with its patch raised (`0.2.1-dev.214`): works equally; the owner prefers the number to read as the next minor.
- Replacing files inside the live release and moving the tag on each build
  ([earlier form](history/DECISIONS.md#d4)): the manifest can mix old and new, and a moved tag troubles `git fetch --tags`
  in existing clones.

## D5

**Switching to Stable installs the newest stable version at once, after a confirmation, even when it is older than the
installed build.** (2026-11-04, owner)

**Why.** Someone leaves Development mostly to escape a bug, and waiting for the next release would leave them in it. The
local copy is ready for it (evidence under [D1](#d1)): an older database is dropped and fetched again, so the cost is one
first sync. Only this switch may install an older version: the updater's normal comparison stays strictly greater.

Proposed by the design agent, accepted by the owner: the rule holds no state, so it survives being offline or a failed download:
a running `-dev` build on Stable accepts any stable version. Switching checks at once, even if an update is already waiting,
and on macOS and Linux whatever was installed last is what runs. Switching to Development waits for a build newer than the installed
version, so a Stable that was just released is not replaced by the same code under a lower number.

**Rejected.**

- Waiting until Stable catches up: no code, but a bug stays until the next release.

## D6

**The plain-language summary is written by an agent the owner runs locally on the draft release, through a repo skill
named along the lines of `release`, before publishing.** (2026-11-04, owner)

**Why.** Publishing is already a hand step, and this needs no API key in the repository. A forgotten summary leaves a
release with the formal list, which is still correct.

**Rejected.**

- An agent in CI with a secret: would win if someone else cut releases, or if they became frequent.

## D7

**After an update the app says so with a toast in a corner; what changed opens from it.** (2026-11-04, owner)

**Why.** A window opening by itself would get in the way, above all on a stream that updates often. Toasts already exist
(`packages/app/settings/SyncStoppedToast.vue`). Consequence: a summary is read only by someone who clicks.

**Rejected.**

- A panel that opens by itself on Stable and a status bar mention on Development (design agent's proposal): the owner
  chose one toast.

## D8

**The `web` and `cloud` scopes stay on `feat` and `fix`, with a sharper definition: `web` is what only the website has
(the landing page), `cloud` is the Worker, and a change to the shared app is never scoped.** (2026-11-04, owner)

**Why.** A landing page's fix is still a fix and belongs under its own type. The scope only keeps it out of the desktop
version and notes; it decides no build ([D4](#d4)).

> **Checked 2026-11-04:** the title decides neither deploys nor checks. `deploy.yml` runs on every push to `main`, and
> `pr.yml` chooses what to run from paths (`code`, from `hasNoCode`). So "`chore` might skip a deploy" is not why `chore`
> was rejected here; the owner's preference for the true type is.

`checkTitle` refuses a scope when the PR touches none of its paths: `web`
needs something in `packages/app/landing/` or `packages/worker/`, `cloud` something in `packages/worker/`.

> **Checked 2026-11-04:** against the four scoped PRs on `main`: #96 (only `packages/app/tracking/TrackPickerDialog.vue`) is
> refused, #98, #88 and #81 pass. "Only those paths" would wrongly refuse #88, which also changes `nuxt.config.ts` and
> `packages/app/app/`, so a mixed PR with a wrong scope stays possible.

**Rejected.**

- Removing the scopes and titling such work `chore` (design agent's proposal): the owner keeps the true type.

## D9

**Two streams, Stable and Development. No Nightly for now.** (2026-11-04, owner)

**Why.** Nightly would run the same builds and differ only in offering a restart less often, and a restart is never forced:
on macOS and Linux the update installs in the background and runs at the next launch, and checks stop once one is ready
(`packages/desktop/src-tauri/src/updater.rs:5`, `:84`). Its only user today would be the owner, who wants fresh builds.

**Rejected.**

- Nightly as a third stream: one more moving release, a schedule and a third option in Settings. Would win when someone
  wants fresher code than Stable but finds Development too busy. Adding it later is cheap: a daily copy of the last green
  Development build, under the same `-dev.N` numbers, because `dev.215` sorts below `nightly.214` and moving between them
  would read as a downgrade.

## D10

**The app reads what changed from GitHub when it needs it. On Stable, the descriptions of the releases between the old
version and the new one, newest first. On Development, the commits between the old build and the new one, filtered by the
same rule as the release notes; the app knows its own commit hash.** (2026-11-04, owner)

**Why.** A correction to a release's description reaches users even after publishing, and the owner edits descriptions on
the draft, after the build. GitHub stays the only source. Accepted: offline, the list appears once back online. The
evidence for both calls is under [D3](#d3).

**Rejected.**

- Writing the changes into the app at build time: works offline, but edits made after the build would never arrive.
- A release per Development build, so that the app reads one kind of source: see [D4](#d4).
- One read for both streams, the description of the release the app is on, with Development's description written by each build
  (rightsize, 2026-11-04): no hash and no filter in the app, but Development would list everything since the last stable, and
  skipped stable versions would hide behind a link. The owner kept the exact ranges.

Proposed by the design agent, accepted by the owner: the toast always appears after a version change, the list is fetched when it is
opened, and a failure offers a link to GitHub. After going back to an older stable version there is no list.

## D11

**Development checks for updates every 15 minutes and Stable every 4 hours, and a "check now" action exists in Settings
and the command palette.** (2026-11-04, owner)

**Why.** Four hours (`packages/desktop/src-tauri/src/updater.rs:21`) can't deliver "what I just merged". Fifteen minutes is a
proposal, not a measurement. Whether GitHub limits such downloads of a release asset: not checked.

Check now reports its outcome: up to date, or that it failed. Today the updater shows no errors
(`packages/desktop/src-tauri/src/updater.rs:11`), so this is new. It is also meant to outlive this design's needs (owner).

**Rejected.**

- Dropping check now, since a restart also checks (rightsize, 2026-11-04): the owner wants it, now and later.

## D12

**Accepted without code: a draft can be published by hand with a platform missing, because the failed check warns and does not
block; and a published version number is never reused, so a bad release is fixed by the next one.** (2026-11-04, owner)

**Why.** Publishing is the owner's own step, and no app can tell that a version's contents changed under the same number.

## D13

**Work goes in this order: the Development stream and its choice in Settings; what changed and the toast; then the Apple
signature and the first Stable, 0.1.0.** (2026-11-04, owner)

**Why.** Development needs nothing from Apple, so the owner can start testing updates on themselves at once. The toast depends on
a recorded last-run version, which the first public version has to write for its successor to show anything.
