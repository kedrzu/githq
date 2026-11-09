# What is githq

githq is a fast, keyboard-first app for GitHub Issues, Projects, pull requests and Actions across all your
repositories. It is a client for GitHub, not a new tracker: everything it shows lives on GitHub, and every change you
make is an ordinary GitHub change.

## One screen for every repository

On github.com, each repository has its own pages: issues here, pull requests there, a failed deploy in a third
repository's Actions tab. githq puts them on one screen.

- **My work** shows what concerns you, from every repository, including other people's: issues assigned to you, your
  pull requests with their checks and reviews, reviews waiting on you, and mentions. See [My work](/using-githq/my-work.md).
- **Repositories** and **Projects** you track open as lists or boards, with the fields, views and iterations each
  GitHub Project defines. See [Repositories](/using-githq/repositories.md) and [Projects](/using-githq/projects.md).
- **Pull requests** can be reviewed, commented on line by line, approved and merged without leaving githq. A stack of
  pull requests shows as one entry. See [Pull requests and reviews](/using-githq/pull-requests-and-reviews.md).
- **Broken workflows** gathers what is failing in GitHub Actions across your tracked repositories, one key away from
  the log.

## Built around the keyboard

The command menu finds any issue, repository or action. Open it with <kbd>⌘</kbd> <kbd>K</kbd> on macOS, or
<kbd>Ctrl</kbd> <kbd>K</kbd> on Windows and Linux. Single keys act on whatever is selected, one item or twenty: set the
status, the assignee or the labels. Press <kbd>?</kbd> to see the keys of the screen you are on. See
[The command menu](/using-githq/command-menu.md).

## GitHub's model, nothing invented

githq maps onto GitHub's own concepts. If your project has a Status field, githq shows and edits that Status. If a
repository has no project, an issue is open or closed, with its labels and assignees, the way GitHub has it. A change
you make in githq is on github.com at once, and a change made on github.com shows up in githq.

The addresses match too. Replace `github.com` with `githq.dev` in a link to an issue, a pull request or a list, and the
same page opens in githq. Whatever githq doesn't show sends you back to github.com.

## Fast because it keeps a copy

githq keeps a copy of your GitHub work on your device and refreshes it in the background. Screens open from that copy,
and your edits show at once while githq writes them to GitHub behind the scenes. There is no githq server holding your
work. [GitHub is the source of truth](/how-it-works/github-is-the-source-of-truth.md) explains how this works.

## Where it runs

Use githq in your browser at [githq.dev](https://githq.dev), with nothing to install, or install the desktop app for
macOS, Windows or Linux. Both are the same app. See [Sign in and install](/getting-started/sign-in-and-install.md).

githq is free and open source under the [AGPL-3.0](https://github.com/kedrzu/githq/blob/main/LICENSE). Its code, issues
and releases are at [github.com/kedrzu/githq](https://github.com/kedrzu/githq). githq is not affiliated with GitHub,
Inc.
