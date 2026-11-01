# Noticing a broken GitHub Actions workflow and finding out why

## Purpose

githq is a fast, keyboard-first client for GitHub Issues, Pull Requests and Projects. It has no server: it polls
GitHub from the browser and works from a local copy, and the user chooses which repositories to track. This path
adds GitHub Actions. The user arrives from anywhere in the app, usually in the middle of something else, having not
asked about Actions at all.

## The user's task

"Something in some repository is failing and I would not have noticed. Show me that it is, which one it is, and
let me work out why, faster than on GitHub." On GitHub, failures are buried, every workflow's runs are mixed
in one feed, and the pages are slow.

## Terms

- **Workflow**: a GitHub Actions automation in a repository, such as Deploy or CI.
- **Run**: one execution of a workflow, on a ref (a branch or tag), started by an event (push, schedule, pull
  request...). A run has jobs, a job has steps, and a job has a text log.
- **Broken**: the workflow's latest finished run on a counted ref failed. It stays broken until a run on such a ref
  passes. A cancelled run changes nothing. Nothing can silence a broken workflow. A workflow disabled or deleted on
  GitHub does not count.
- **Counted refs**: by default the repository's default branch. Runs started by a pull request never count. The
  repository's settings can add patterns with wildcards, such as `release/*` or `v*`. They affect only what lights
  the red marker and the total; every workflow and run stays visible in the Workflows tab.

## Screens, in order

### 1. The sidebar, everywhere in the app

The question: is anything broken, and where? It holds:

- one new entry with the total of broken workflows across tracked repositories, leading to screen 2;
- a red marker on the row of each tracked repository with something broken. The row already shows a count of open
  items beside its name, which stays.

The sidebar can collapse to a rail of icons, which does not list repositories, so the total must still be visible
there.

### 2. Everything broken, across repositories

The question: what is broken right now? Each broken workflow: its name and repository, the ref or pattern, its
last few runs, how long ago it failed. Enter on one opens screen 4. Long-broken workflows sit here indefinitely, so
it should be possible to tell a fresh failure from an old one.

### 3. The Workflows tab of a repository

A fourth tab of the repository view, next to All, Issues and Pull requests, at `/owner/name/actions`. It does not
change what the All tab shows: workflows never appear among issues.

The question: how is each workflow in this repository doing? One row per workflow, all of them, passing ones too,
with its state and its recent runs, not one mixed feed. Rows include:

- broken: `Deploy` on `main`, last runs pass, pass, fail, fail, fail;
- passing: `Probe` on `main`;
- a workflow that runs only on pull requests, such as `CLA`, which has a state of its own but lights nothing, and can
  still show that some of its pull request runs failed;
- a broken workflow on a tag pattern, such as `Release` on `v*`;
- a workflow GitHub generates itself, such as Dependabot or Pages, with no file in the repository; it counts like any
  other;
- a workflow disabled on GitHub.

The user must also be able to get from a workflow to its other runs, on any ref, and open one. The way to the
repository's ref patterns starts here.

### 4. A failed run

Enter on a broken workflow goes straight to its latest failed run, with no list of runs in between. The address is
GitHub's: `/owner/name/actions/runs/123`.

The question: why did it fail? In order of importance:

1. the log of the failed job, at the failed step;
2. the jobs, failed first. A run can have many (a real one: seven, one failed, one skipped);
3. what this run is: workflow, ref, event, commit, when.

The whole log is available, split by steps, with the failed step open. It starts at GitHub's error marker, but that
marker usually says only "exit code 1", and the cause can be anywhere above it, so reading and searching a log of
thousands of lines has to be comfortable. Moving between jobs, steps and errors is by keyboard.

Commands: re-run the failed jobs, in the command menu only, deliberately with no single-key shortcut; open on GitHub,
with one key.

### 5. A repository's ref patterns

The question: which refs light the counters for this repository? A short list of patterns with wildcards, the default
branch by default. Ideally it shows what a pattern matches, from runs githq already knows.

## States

- **Nothing broken**: the total and the markers say so calmly.
- **Not known yet**: a repository just tracked, or the local copy rebuilt. This is not the same as healthy, so do not
  show a zero or green until the first read has finished.
- **No workflows**, in a repository without any, and **Actions unavailable**, if GitHub refuses or Actions is turned
  off. Neither looks healthy, and neither adds to the total.
- **A running workflow**: a broken workflow with a new run in progress stays broken until the run finishes, and shows
  the run. A running job's steps show their status; its log cannot be streamed, so the way forward is GitHub.
- **Log loading**: screen 4 opens at once with what githq already knows, and the jobs and the log load in place.
- **Stale**: the last read is older than expected (offline, refused, or rate limit reached). The app's existing status
  bar covers this; the last known state stays visible.

## Failures that must be visible

- The workflow file is invalid: the run failed with no jobs and no log.
- The log is gone, past GitHub's retention (90 days by default), while the workflow is still broken.
- A failed job without an error marker, such as a runner that died. The log starts at its end.
- One job's log fails to load while the rest of the screen works, with a way to try again.
- GitHub refuses the re-run: no permission, too old (about a month), or already running. Re-running changes the run's
  state to running.

## Technical constraints

- Polling is every 3 minutes, and at once when screen 2 or 3 opens, so a red marker can be minutes late. githq cannot
  notify anyone while it is closed.
- Workflows and a few recent runs are in the local copy and appear instantly. Other refs' runs, jobs and logs are read
  on demand and are the only places a wait can appear. Logs are not stored.
- A log is a plain text file, measured at 176,562 characters over 2,086 lines; its step sections are marked in the
  text. A log can be much bigger.
- Everything is reachable from the keyboard: list movement, opening, the command menu.

## Questions this design should settle

- How the total and the marker draw attention without going numb when something stays broken for weeks.
- How to show recent runs in a row so that a pattern reads at a glance, including running and cancelled runs.
- Whether screen 4 is a full page or uses the app's existing side panel and modal for items.
- How to move through a big log by keyboard: between steps, between errors, and searching.
- Whether screen 5 is a dialog, part of the tab, or a page.
