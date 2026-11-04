# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the
decision's ID alone, so `DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired
decisions, the journal and notes from reviews live in [history/](history/).

**Before proposing a change in an area, read the Rejected lines of its decisions and the history
they link to.** Reopening a rejected option is right when its premise changed; repeating it without
knowing it was rejected is not.

## D1

**One app with two update streams, stable and builds from `main`; the user picks one in Settings.** (2026-11-04, owner)

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

**macOS and Linux first; Windows once it can be signed.** (2026-11-04, owner) Open: this clashes with the first check
below, and has not been resolved with the owner.

**Why.** The owner gave the order, not the reason. Inferred by the design agent, unconfirmed: the unsigned Windows
experience is the obstacle (SmartScreen warnings; Smart App Control blocks unsigned apps outright, per the root
`README.md`).

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
a plain-language summary of the most important changes, written by an agent; builds from `main` get the list only.**
(2026-11-04, owner)

**Why.** The formal list costs nothing, because the titles already carry it: `packages/app/scripts/releasePlan.ts:118`
renders the notes from them today. A summary is worth writing only for what comes rarely.
