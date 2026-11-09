# Choose what to track

Tracking a repository or a project tells githq to keep all of it on your device and in sync. What concerns you comes
along anyway, from any repository, so you only track what you want to browse and triage in full.

## What concerns you, and what you track

githq's copy of your GitHub data has two parts:

- **What concerns you**: open issues and pull requests anywhere on GitHub that are assigned to you, that you opened,
  that ask for your review, or that mention you. githq finds them through GitHub's search, without any tracking. They
  are what [My work](../using-githq/my-work.md) shows, including the pull request you opened on someone else's
  open-source project.
- **What you track**: repositories and GitHub Projects you choose. githq copies them in full, other people's issues and
  pull requests too, and keeps them in sync in the background.

If you work in a handful of your own repositories, the two parts mostly overlap. If you belong to an organisation with
hundreds of repositories, track the few you work in: copying all of them would cost time and API allowance for issues
you never look at.

## The first sign-in

The first time you sign in, githq asks **Which of these do you work on?** and lists your repositories and projects.

- Your own repositories and their open projects start selected. Nothing of your organisations does.
- **Owners** narrows the list to some accounts and organisations, and the filter field finds a repository by name.
- **Only my repositories** tracks your own repositories and no projects.
- **Track these** keeps your choice and takes you to My work.

If you have no repositories yet, githq says so and offers **Continue to My work**. My work still shows what concerns
you anywhere on GitHub.

What you track then downloads in the background, open issues and pull requests first, closed ones after. You can work
while it does: see [what "still arriving" means](../how-it-works/github-is-the-source-of-truth.md#still-arriving).

::: tip
Under the list there is a box: **Save my settings to my GitHub account**. Tick it, and another computer can load what
you track when you sign in there. It starts unticked. See [Save what you track to GitHub](#save-what-you-track-to-github).
:::

## Tracked and not tracked

You can open any repository GitHub shows you, tracked or not. The difference is what githq keeps and how it stays fresh.

||Tracked|Not tracked|
|-|-|-|
|What githq keeps|Every issue and pull request, open and closed|What concerns you, plus the pages you scroll through while you browse|
|How it stays fresh|Checked in the background, about every minute while githq is in view|Checked every minute only while its screen is open; never in the background|
|Command menu and search|Find everything in it|Find only what githq has read|
|Workflows|Shown, with failures in Broken workflows|Not shown|
|In the sidebar|Listed under Repositories|Not listed|

A repository you don't track opens in the same full view, with a **not tracked** chip, and reads more of it from GitHub as you
scroll. You can edit its issues and pull requests as in a tracked one, as far as GitHub lets
you. githq keeps what it read for 10 minutes after you leave, so coming back is instant, and then lets it go unless
something else needs it.

Projects work the same way. A tracked project brings every item it holds, even from repositories you don't track, with
its fields, views and iterations. A project you don't track shows only the items that concern you.

## Track or stop tracking later

**From the command menu.** Open it with <kbd>⌘</kbd> <kbd>K</kbd> (<kbd>Ctrl</kbd> <kbd>K</kbd> on Windows and Linux)
and choose **Search repositories…** to find any repository on GitHub and open it. On the screen of a repository you
don't track, **Track repository** is the last line of the command menu.

**From the sidebar.** The menu of a tracked repository or project in the sidebar has **Stop tracking**.

**In Settings.** Press <kbd>,</kbd> or choose **Settings** in the sidebar.

- **Repositories** lists what you track. **Track repositories** opens a picker: what you tick is copied to this device
  and kept in sync from then on. **Untrack** on a row stops tracking it.
- **Projects** does the same for projects, with **Track projects**.
- Open a row for that repository's or project's own settings. Its **Tracking** block has **Untrack** too.

When you stop tracking something, a toast offers **Undo**. Its copy on this device is deleted when the toast closes.
Nothing changes on GitHub.

## Save what you track to GitHub

By default, what you track is kept on this device only. Sign in on another computer and githq asks again.

Tick **Save my settings to my GitHub account**, at the first sign-in or in **Settings → Sync settings**, and githq
creates a private repository named `githq-settings` in your account, with one file, `settings.json`. It holds what you
track and a few display choices, such as the repository layout. How your views look, their layout, sort and filter,
stays separate on each device.

When you sign in on another computer, githq finds that repository and asks **Load your saved settings?** Choose **Load
these** to track the same things there, or **No, I'll choose here**. From then on, both devices stay in step: something
you start tracking on one is tracked on the other the next time you open githq there.

**Settings → Sync settings** shows the repository and when this device last synced. **Turn off** stops syncing on this
device. What you track here stays, and so does the repository. githq has no permission to delete repositories, so
remove `githq-settings` on github.com if you no longer want it.

::: info
If something gets in the way, such as the repository deleted, made public, or `settings.json` edited into something
githq can't read, githq shows **Syncing stopped** with the reason. It keeps working from what is on this device and
writes nothing to GitHub until that is fixed.
:::

## Organisations that hide their repositories

If an organisation lets only approved apps see its private data, the picker marks it as **private repositories
hidden** and lists only its public repositories. Choose **Why, and how to fix** to request approval on GitHub. Once an
owner approves githq, its repositories appear on githq's next refresh, unselected. See
[Privacy and permissions](../how-it-works/privacy-and-permissions.md#organisations-that-restrict-apps).
