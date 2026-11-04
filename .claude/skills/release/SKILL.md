---
name: release
description: Write the plain-language summary of a draft desktop release of githq and put it on the draft, above the formal list of changes, before the owner publishes it. Use when the owner says "release", "write the summary", "podsumuj wydanie", "wydajemy", or when a Stable draft is waiting on GitHub Releases. How to cut a release at all is in `docs/desktop/RELEASING.md`.
---

# Release summary

A Stable release's description is what the app shows in Settings → Changelog: a few sentences in plain language about what matters most, then the formal list. The list is generated from PR titles; this skill writes the sentences (`docs/design/desktop-releases/DECISIONS.md` D3, D6).

1. Find the draft and read it:

   ```bash
   gh release list --limit 5
   gh release view <tag> --json body,tagName,isDraft
   ```

2. Read what the list stands for: the PRs it names (`gh pr view <N> --json title,body`) where a title doesn't say enough. The release is whatever went in since the last stable tag.

3. Write 2 to 4 sentences, in English, for someone using the app, not reading the code: what they can now do or stop worrying about, the biggest thing first. No version number, no PR numbers, no "this release", no heading. Leave out what they wouldn't notice. On the first release, say what githq is.

4. Put it above the list, keeping the list untouched:

   ```bash
   gh release view <tag> --json body --jq .body > .context/notes.md
   # write the summary, a blank line, then the contents of .context/notes.md into .context/release-body.md
   gh release edit <tag> --notes-file .context/release-body.md
   ```

5. Show the owner the sentences. Publishing is their word (`RELEASING.md`), unless they already gave it for this release.
