# Path: the desktop app — signing in with a code, and updating

Read `README.md` in this folder first.

**Status:** designed in `githq.pen`, frames "Desktop · Sign in with a device code" (S1–S4) and "Desktop · Updates"
(U1 chosen, U2 an alternative not chosen, U3–U48 the update streams and the changelog; U26–U37 are gone).

## Purpose

The desktop app is the same githq in a native window. Only two things differ from the web: how the user signs in
and how a new version arrives. Everything else (my work, projects, items, the palette) is unchanged and needs no
screens of its own. Why the updates work as they do: [desktop releases](../../desktop-releases/README.md).

## The user's task

"Let me sign in without handing my GitHub token to anyone but GitHub, and keep the app current without it
getting in my way."

## Signing in with a code

1. **Before signing in (S1).** The desktop app's own screen: the web has no such screen and goes from the landing
   page straight to GitHub ([D21](../DECISIONS.md#d21)), and the desktop app has no landing page, so it opens here
   signed out, whatever address it opens at. It says what githq is and what GitHub will ask for, and that the data
   stays "On this computer, and nowhere else". The action is "Sign in with GitHub" (↵).
2. **The code (S2).** githq asks GitHub for a short code and shows it large, in the monospace font, with a label.
   The main action "Copy code and open GitHub" (↵) copies it and opens github.com/login/device in the system
   browser, where the user pastes it and approves githq. "Cancel" (Esc) abandons the code. A quiet line says
   githq is waiting for GitHub and how long the code works, using the lifetime GitHub returned (about 15 minutes).
   The window carries on by itself once GitHub reports the approval. There is nothing to click back in the app.
3. **Landing.** Signed in, the user continues as on the web: choosing what to track on first sign-in, or straight
   to my work.

## States

- **Failed (S3).** The code expired, the user declined on GitHub, GitHub can't be reached, or something else
  went wrong. One line says which, the action becomes "Get a new code", and what GitHub will ask for waits behind
  "Why?". The user is never left on "Waiting".
- **Less access than needed.** GitHub granted fewer scopes than githq asks for: nothing is kept, and the screen
  says so.
- **No keychain (S4).** The system keychain can't be reached (a Linux desktop without a Secret Service, a refused
  keychain). A quiet note on the sign-in screen says up front that the user will sign in again next time.
- **Signed out by GitHub.** The kept token stopped working (revoked on github.com). The sign-in screen says why
  the user is back there.

## Updating

- The app looks for a new version in the background and downloads it. Nothing interrupts the user.
- **Ready (U49).** A pinned toast in the bottom right corner: "githq X.Y.Z is ready", Restart (⌥R) and Dismiss.
  Restart starts the new version. Dismiss is Later: the toast comes back on the next launch or the next Check for
  updates, and meanwhile the right end of the status bar keeps a quiet "githq X.Y.Z ready · Restart" (U50). While the
  toast shows, the status bar says nothing about the update. Restart and Later are in the command palette while an
  update is ready. U1, the status bar's offer alone, was too easy to miss (owner, 2026-11-06).
- **Never forced.** Nothing restarts on its own. On macOS a downloaded update also runs from the next launch if the
  user just quits. On Linux it installs only when the user clicks Restart.
- U2 is an alternative drawn beside U1 and not chosen.

## Updates in Settings

A section only the desktop app has, after Account, with the key 6.

- **What is running (U3, U4).** The version in the monospace font (`0.2.0`, `0.3.0-dev.214`), and under it what kind of
  build that is and which stream it follows, since after a switch the two can differ. A Development build also names
  its commit.
- **Check for updates (U), with one status line under the version:** checking (U5), up to date (U6), found and
  downloading with its progress (U7), ready with Restart (U8, the status bar's U1 too), failed because the user is
  offline or GitHub can't be reached (U9, U10), and no release on this stream yet (U11). The button is also how to try
  again after a failure.
- **The stream.** Two radio options, Stable and Development, marked as being on this device only. Development says there
  that a build may have bugs.
- **Windows (U12).** No Development builds, so no stream block at all.

## Switching streams

- **To Stable from a Development build (U13).** A confirmation: the newest Stable installs at once, it can be older than
  the running build, and the local copy of GitHub data is fetched again, which costs one first sync and nothing else.
  It names no Stable version, because that would take a request before it could open. Then the download (U14) and U1
  (U15). Offline (U16), the choice stands and the newest Stable installs once GitHub can be reached. With no Stable yet
  (U17), the user stays on the build and gets no updates until 0.1.0 or until they go back to Development.
- **To Development (U18).** No confirmation and no install. It waits for a build newer than the installed version, so
  right after a Stable release it says nothing is newer yet.
- **From a Stable version following Development, back to Stable.** Nothing older can install, so no confirmation.
- **A fresh install follows what it is (U19).** A Development build starts on Development, any other build on Stable,
  and nothing is asked.

## Update commands in the command palette

Every update action is a command in ⌘K, shown only while it can run ([D18](../../desktop-releases/DECISIONS.md#d18)): Check
for updates, Settings: Updates, Settings: Changelog, Switch to Stable or Development, Restart, Later, Try again and What changed.

Check for updates is the same action as in Settings (U20). The palette closes on running it and the outcome appears at the right end of the status
bar, where U1 speaks (U21), never as a toast. U22 has every outcome. Up to date goes away by itself; a failure stays until
Try again or Dismiss. A check nobody asked for says nothing until U1.

## After an update

- **The toast.** On the first launch after the version changed, in the bottom right corner above the status bar, a brief
  toast: it goes by itself after 6 seconds, not while hovered or focused ([D40](../DECISIONS.md#d40)). No window opens by itself. Stable (U23) and Development (U24) offer "What changed" (⌥W, also a command in ⌘K
  while the toast shows), which goes to the changelog. After going back to an older Stable (U25) it says which version is
  running and offers nothing.
- **Changelog.** A section of Settings, after Updates, with the key 7, on the desktop app only. Every version has its own
  fold, newest first, the first open and the rest collapsed, and each opens on its own. There are no ranges between
  versions: a version says its own changes.
  - Stable (U41): a plain-language summary, then the list under Breaking changes, Features, Fixes and Performance. A release
    can have no summary (U42). "New" marks versions the user didn't have before this update, "Running" what is installed.
  - Development (U43): one fold for everything since the last Stable, filtered as release notes
    are, then the Stable versions. It can be empty, "Nothing you'd notice" (U44).
  - No versions yet (U45), loading (U46), offline, where the list waits for the connection (U47), and failure, with a link to
    the same changes on GitHub (U48).

## A refused install on Linux

When the user refuses the system's password prompt, or the install fails, the ready toast comes back saying so, with Try
again (⌥R) and Dismiss (U51); after Dismiss the status bar keeps "couldn't be installed · Try again" (U38), and Settings says
the same (U39). While the system is asking, the segment waits and
offers nothing. U40 has the whole sequence.

## Also part of this path

- **Links leave the app.** Every link to github.com or anywhere else opens in the system browser, and the app
  stays where it was. This includes "open on GitHub", links in an issue's text, and the organisation-approval
  link.
- **No sign-in step through githq.dev.** The desktop app never talks to githq's own servers ([D23](../DECISIONS.md#d23)).
