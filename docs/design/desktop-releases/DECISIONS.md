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
> 16:50:18, about 9 minutes. Windows was one of the parallel builds and among the slowest, finishing with Linux at 16:50:11.

> **Checked 2026-11-04:** nothing is published: the repository has 0 releases and 0 tags
> (`gh api repos/kedrzu/githq/releases`, `…/tags`).

## D2

**macOS is signed and notarized, on an Apple Developer account the owner is creating; Linux needs no signature. Windows
ships in Stable releases only, as an unsigned download with an explicit warning, until a signature exists, and gets no
Development builds.** (2026-11-04, owner) Open: whether the Apple account is personal or a company's.

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

Proposed by the design agent, not yet confirmed: the version is the next stable version plus `-dev.N`, with N the commit
count on `main`, which only ever grows; a push is skipped when it reaches no desktop user (`docs`, or the `web` and `cloud`
scopes); the moving tag is `development`, outside the `v*` tags the version is computed from.

**Rejected.**

- A build once a night: a merge would wait until the next day to be tried, and the name would have to be earned by a
  schedule nobody needs.
- A release per build: per-build history and rollback, at the cost of hundreds of prereleases to prune and a separate
  pointer release still needed for the fixed manifest URL.
- The name "nightly": these builds don't come nightly.

## D5

**Switching to Stable installs the newest stable version at once, after a confirmation, even when it is older than the
installed build.** (2026-11-04, owner)

**Why.** Someone leaves Development mostly to escape a bug, and waiting for the next release would leave them in it. The
local copy is ready for it (evidence under [D1](#d1)): an older database is dropped and fetched again, so the cost is one
first sync. Only this switch may install an older version: the updater's normal comparison stays strictly greater.

Proposed by the design agent, not yet confirmed: switching to Development waits for a build newer than the installed
version, so a Stable that was just released is not replaced by the same code under a lower number.

**Rejected.**

- Waiting until Stable catches up: no code, but a bug stays until the next release.
