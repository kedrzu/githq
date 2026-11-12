# Setting githq up on a phone: signing in, choosing what to track, and Settings

The brief for the phone's first sign-in and its Settings. The product, its data and Direction D are in
[the app's brief](../../githq/ui/README.md). The same path on the computer is in
[the desktop's first sign-in brief](../../githq/ui/first-sign-in.md), drawn as G1–G17 in `githq.pen`, and
[the first-run design](../../first-run-and-loading/README.md) removed its download screen; the desktop's Settings
screens are in `githq.pen` too. Read those: this file only says what is different on a phone. The rules for the design
file are in the `design` skill.

## Purpose

Someone's first contact with githq may well be on a phone: a link opened from a chat, a recommendation. They have to
get from the landing page to their own work without a computer, and later change what githq tracks, again without a
computer. A phone's settings are not necessarily synced from the computer — keeping settings in a private repository
of the user's is optional — so the phone has to be able to set itself up on its own.

## What is already settled

- The landing page (githq.dev) already has its phone layout. "Sign in with GitHub" goes straight to GitHub's consent
  screen; there is no sign-in screen of githq's own before it.
- After "Track these" the app goes straight to My work; there is no download screen. Each screen says itself what is
  still arriving.
- **Settings on a phone has the same sections as on the computer**: repositories and projects tracked, and each
  tracked one's own settings screen; display (animations only — the repository layout, tabs or a column, is a computer
  setting and is not shown); code review's comment setting; where settings are saved; account. githq has no
  notifications, so there are no notification settings.
- The phone's navigation is settled and drawn in `App · Mobile`: no bottom tab bar, a command line floating over the
  bottom with ⌘ that leaves inside a task, the command menu rising from below, the places as a panel from the top-left
  with the account at its foot, back with the list's name on the top-left of a screen you went into. Build on it.
- No menu opens by swiping from an edge of the screen.

## The user's task

"Let me in, let me pick the repositories I actually work on, and get out of the way." And later: "start tracking this
other repository", "stop tracking that one", "sign out".

## Screens, in order

1. **Coming back from GitHub, saved settings found.** If the account already keeps settings in a repository, githq
   offers to load them instead of choosing again.
2. **Choosing what to track.** It answers: *which of these do I actually work on?* Repositories and projects. Per
   repository: name, owner, private or public, how recently it saw activity. Per project: title, owner, how many items.
   Own repositories pre-selected, organisations' not. The list can hold hundreds of repositories, so finding one by
   typing matters, with the phone's keyboard taking half the screen. A repository not in the list can be added by its
   name. The unticked option to keep settings in a private repository, and "Track these".
3. **An organisation that hides its private repositories.** Many organisations block third-party apps until an owner
   approves them. The user sees the organisation and must see why its private repositories are missing, with a way to
   request approval on GitHub. **Must be visible**, or the app looks broken.
4. **Landing on My work** while the first download is still running: the screen's own "still arriving" state.
5. **Getting to Settings**: from the places panel's account at its foot, and from the command menu.
6. **Settings' sections.** On the computer they are a column beside the section's content. On a phone they are
   screens you go into and come back from.
7. **Tracking, later**: the repositories and the projects tracked, adding one (the same choosing as on first sign-in),
   stopping tracking one, and a tracked repository's or project's own settings screen.
8. **The other sections**: display, code review, where settings are saved, account (who you are signed in as, signing
   out — which also clears the copy kept on this device — and the organisations hiding their private data, each with a
   way to request approval).

## States

- **Sign-in cancelled or failed** on GitHub's side: back on the landing page with one line saying what happened and
  "Try again".
- **No repositories at all**: a brand-new account. My work still works, and other people's projects can be tracked.
- **Signing in again later**, the copy still on the device: straight to My work, no choosing.
- **Stopping tracking**: what happens to that repository's copy on the device must be clear before the tap, as on the
  computer.

## Technical constraints

- `/settings` is githq's own page under an address GitHub reserves, and each section has its own address
  (`/settings?tab=display`); the first section, repositories, has none of its own on the computer. A tracked
  repository's settings are at `/owner/name/settings`. The screens may assume addresses for the list of sections and
  for each section; whether `/settings` on a phone shows the list of sections rather than the first section is one of
  the questions below.
- Settings behave as they do on the computer; a phone adds no saving step of its own.
- Later, the same screens become part of a hybrid phone app. There, signing in will work differently (as the desktop
  app does, with a code typed on github.com); that is not drawn now.

## Questions this design should settle

Draw each as variants side by side, Variant A the one you recommend, as the `design` skill says, and propose others where you
see them.

- **How Settings' sections are reached.** A list of sections first, each opening its own screen, against the first
  section open with the others reachable from its top, against one long scrolling screen with every section in it.
- **Choosing what to track with a long list and the keyboard up**: where the search sits, how selected repositories
  stay visible, where "Track these" goes so the keyboard does not cover it.
- **Adding a repository later**: the same screen as the first sign-in, or a picker rising from below as the command
  menu does.

## Where to draw it

In `App · Mobile`, the next MB codes, reusing its components, Direction D's, and the desktop first sign-in's and
Settings' components where they fit.
