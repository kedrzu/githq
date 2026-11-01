# Path: the desktop app — signing in with a code, and updating

Read `README.md` in this folder first.

**Status:** designed in `githq.pen`, frames "Desktop · Sign in with a device code" (S1–S4) and "Desktop · Update
ready" (U1 chosen, U2 an alternative not chosen).

## Purpose

The desktop app is the same githq in a native window. Only two things differ from the web: how the user signs in
and how a new version arrives. Everything else (my work, projects, items, the palette) is unchanged and needs no
screens of its own.

## The user's task

"Let me sign in without handing my GitHub token to anyone but GitHub, and keep the app current without it
getting in my way."

## Signing in with a code

1. **Before signing in (S1).** The same screen as on the web (G1b): what githq is and what GitHub will ask for,
   with one difference in the copy about where data goes: "On this computer, and nowhere else". The action is
   "Sign in with GitHub" (↵).
2. **The code (S2).** githq asks GitHub for a short code and shows it large, in the monospace font, with a label.
   The main action "Copy code and open GitHub" (↵) copies it and opens github.com/login/device in the system
   browser, where the user pastes it and approves githq. "Cancel" (Esc) abandons the code. A quiet line says
   githq is waiting for GitHub and how long the code works, using the lifetime GitHub returned (about 15 minutes).
   The window carries on by itself once GitHub reports the approval. There is nothing to click back in the app.
3. **Landing.** Signed in, the user continues as on the web: choosing what to track on first sign-in, or straight
   to my work.

## States

- **Failed (S3).** The code expired, the user declined on GitHub, GitHub can't be reached, or something else
  went wrong. One line says which, and the action becomes "Get a new code". The user is never left on "Waiting".
- **Less access than needed.** GitHub granted fewer scopes than githq asks for: nothing is kept, and the screen
  says so.
- **No keychain (S4).** The system keychain can't be reached (a Linux desktop without a Secret Service, a refused
  keychain). A quiet note on the sign-in screen says up front that the user will sign in again next time.
- **Signed out by GitHub.** The kept token stopped working (revoked on github.com). The sign-in screen says why
  the user is back there.

## Updating

- The app looks for a new version in the background and downloads it. Nothing interrupts the user.
- **Ready (U1).** At the right end of the status bar, one quiet segment: "githq X.Y.Z is ready · Restart ·
  Later". Restart starts the new version. Later hides the segment until the next launch. The same two actions are
  in the command palette while an update is ready.
- **Never forced.** Nothing restarts on its own. On macOS and Linux a downloaded update also runs from the next
  launch if the user just quits.
- U2 is an alternative drawn beside it and not chosen. U1's place is the status bar, where githq already says how
  fresh things are ([D15](../DECISIONS.md#d15)).

## Also part of this path

- **Links leave the app.** Every link to github.com or anywhere else opens in the system browser, and the app
  stays where it was. This includes "open on GitHub", links in an issue's text, and the organisation-approval
  link.
- **No sign-in step through githq.dev.** The desktop app never talks to githq's own servers ([D21](../DECISIONS.md#d21)).
