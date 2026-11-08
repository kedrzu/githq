---
name: release
description: Take a Stable desktop release of githq from start to published on the owner's word — run the Release action, get past failures, check the draft, write the plain-language summary above the formal list of changes, publish. Asks the owner only for what really needs them. Use when the owner says "release", "/release", "wydajemy", "wydaj", "zrób release", or asks to finish a Stable draft waiting on GitHub Releases. The details behind each step are in `docs/desktop/RELEASING.md`.
---

# Release

The owner's word to release covers the whole way to published (`docs/design/desktop-releases/DECISIONS.md` D6). Don't ask for confirmation between the steps, and don't ask before publishing. Stop only at a point under "Stop and ask".

## 1. Start or pick up

```bash
gh api repos/kedrzu/githq/releases --jq '.[] | select(.draft and (.prerelease | not)) | [.tag_name, .created_at] | @tsv'
```

A Stable draft listed here is the release: find its run and carry on from there. A draft named Development is not yours. Otherwise start one:

```bash
gh workflow run release.yml --ref main -f mode=stable
gh run list --workflow release.yml --limit 1 --json databaseId,url
```

Wait for it with a background command, which wakes you when it exits: `gh run watch <run> --exit-status --interval 60`. A release takes about 15 minutes.

## 2. Get the run green

Read the failure first: `gh run view <run> --log-failed`. The ways past a failed build, without starting over, are in `RELEASING.md` → "If a build fails".

- **A build failed:** `gh run rerun <run> --failed`.
- **`updater-json` says `latest.json` lacks a platform:** re-run that platform's build alone, one at a time, waiting for each: `gh run rerun --job <job id>`. Re-running failed jobs would repeat only the check.
- **Nothing user-visible since the last stable tag:** the run says so and makes no tag. Tell the owner what you found; there is nothing to release.

Never publish with a red run.

## 3. Check the draft

- The installers for every platform and each updater bundle with its `.sig` are there.
- `latest.json` has the draft's version and the platforms `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64` and `linux-x86_64`.
- Each platform's `signature` in `latest.json` equals the `.sig` file of the bundle its `url` names.

## 4. Write the summary

A Stable release's description is what the app shows in Settings → Changelog: a few sentences in plain language about what matters most, then the formal list generated from PR titles (D3).

Read what the list stands for: the PRs it names (`gh pr view <N> --json title,body`) where a title doesn't say enough. The release is whatever went in since the last stable tag.

Write 2 to 4 sentences, in English, for someone using the app, not reading the code: what they can now do or stop worrying about, the biggest thing first. No version number, no PR numbers, no "this release", no heading. Leave out what they wouldn't notice. On the first release, say what githq is.

Put it above the list, keeping the list untouched, after the last re-run:

```bash
gh release view <tag> --json body --jq .body > .context/notes.md
# write the summary, a blank line, then the contents of .context/notes.md into .context/release-body.md
gh release edit <tag> --notes-file .context/release-body.md
```

## 5. Publish

```bash
gh release edit <tag> --draft=false --latest
curl -sL https://github.com/kedrzu/githq/releases/latest/download/latest.json | jq -r .version   # must print the new version
curl -sI https://githq.dev/download/windows | grep -i '^location'   # the new version's installer, within 5 minutes
```

## 6. Report

Tell the owner it is out: the version, the sentences, the link, and anything that went wrong on the way. A failure that needed a re-run gets a tracked issue if it has none, as in `git-workflow` → Green.

## Stop and ask

Leave the draft unpublished and bring the owner the finding and your recommendation when:

- The run is still red after two rounds of step 2, or the failure needs a code change.
- A check in step 3 fails and a re-run doesn't fix it.
- What would be published is wrong in a way only the owner can weigh: a version that doesn't fit what went in, or a change in the list that looks like it must not reach users yet.
- A secret, an account or a certificate needs action, such as an expired Apple certificate.
- Going on would mean deleting a tag or a release. Starting over is theirs to call.
