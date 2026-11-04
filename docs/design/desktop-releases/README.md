# Releasing the desktop app, and keeping it up to date

githq's desktop app has never been published. This design takes it from there: a signed app that people can download,
official releases every so often, a second stream of builds straight from `main` for anyone who wants the newest code,
and a list of what changed shown in the app after each update.

## Why

The desktop app can be built today, and nobody has it. Its only release so far was a test candidate that was deleted
again. Anyone who downloaded a build would get a warning from macOS that it comes from an unidentified developer.

The owner is also blocked as a user of the app. Trying a change in the installed app means building an installer by
hand, because there is no stream of builds to stay on. The web version updates itself on every merge, so the desktop
app is the one place where what was just merged can't be felt.

And an update today says nothing. The status bar offers a restart, and after the restart nothing tells you what is new.

## What is different once it exists

Someone downloads githq for Mac from the releases page and opens it without a warning. Weeks later the status bar offers
a restart, and after it the app shows what changed: a few sentences in plain language about what matters most, and
below them the formal list of changes.

The owner merges a pull request and goes back to work. Shortly after, the status bar on their Mac offers a restart,
and the app they run is what they just merged. After the restart a short list says what came in, with no summary,
because these builds come too often to be worth one. Those builds may have bugs, and the app says so where you choose
them: in Settings, you pick Stable or Development, and from then on updates come from that stream.

## What already exists

Most of the machinery is built, so this design is about what is missing rather than a new pipeline. A manually started
GitHub Action works out the version from pull request titles, tags `main`, and builds every platform into a draft
release that the owner publishes by hand. The app checks for updates at launch and every four hours, verifies their
signature, downloads them in the background and offers a restart. [How to run it](../../desktop/RELEASING.md).

Missing: the Apple signature, the builds from `main`, the choice in Settings, and showing what changed.

## Two streams of updates

Stable is what the owner releases by hand when a release is worth it. Development is everything else: every push to
`main` that passes the checks and reaches the desktop app builds it, about nine minutes later it is there, and each build
replaces the last in a single prerelease on GitHub. That keeps the Releases page readable, and it means
[yesterday's build is gone](DECISIONS.md#d4): a broken one is fixed by the next, or left by switching to Stable.

Leaving Development is immediate. Stable is often older than the build you are on, and the updater normally refuses to go
backwards, but someone leaving is usually escaping a bug, so
[the switch installs the older Stable at once](DECISIONS.md#d5), after asking. The local copy of your GitHub data is simply
fetched again.

Replacing means this. The release page stays one page, named Development, under one tag that moves. The number belongs to
the build, not to the page: `0.3.0-dev.214` is written into the app and its files. It is the next stable version plus a
count of commits on `main`, because in version ordering `0.2.0-dev.5` comes before `0.2.0`, so a build numbered from the
current version would look older than the release it came after. Each build uploads its files, swaps the small file the
app reads to learn the newest version, and removes the previous build's files.

## Signatures

macOS needs a paid Apple Developer account, which the owner is creating; the app is then signed and notarized, and opens
without a warning. Linux asks for no signature at all. Windows is the awkward one: the free route for open source signs
only what has already been released unsigned, and approves each release by hand. So
[Windows ships unsigned in Stable, with a plain warning, and has no Development builds](DECISIONS.md#d2). When the
signature arrives, those installs keep updating, because updates are verified with a separate key of our own.

## Still open

- **What changed:** where the app reads it from, who writes the plain-language summary and when, and what someone sees
  after skipping several versions.
- **Apple:** whether the account is personal or a company's.

[Every decision, with the evidence](DECISIONS.md).
