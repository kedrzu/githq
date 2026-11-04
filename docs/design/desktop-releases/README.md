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
them: in Settings, you pick stable or the builds from `main`, and from then on updates come from that stream.

## What already exists

Most of the machinery is built, so this design is about what is missing rather than a new pipeline. A manually started
GitHub Action works out the version from pull request titles, tags `main`, and builds every platform into a draft
release that the owner publishes by hand. The app checks for updates at launch and every four hours, verifies their
signature, downloads them in the background and offers a restart. [How to run it](../../desktop/RELEASING.md).

Missing: the Apple signature, the builds from `main`, the choice in Settings, and showing what changed.

## Still open

This is the start of the conversation, so very little below is settled.

- **Windows.** The plan is to ship Windows once it can be signed, but the free signing route only signs software that
  has already been released unsigned, and it asks for a manual approval of every release.
- **What a build from `main` is:** how often one is made, where it lives on GitHub, and what it is called.
- **Leaving the builds from `main`:** whether switching back to stable installs the older stable version at once, or
  waits for stable to catch up.
- **What changed:** where the app reads it from, who writes the plain-language summary and when, and what someone sees
  after skipping several versions.
- **Apple:** whose name goes on the signature.

[What is decided so far, with the evidence](DECISIONS.md).
