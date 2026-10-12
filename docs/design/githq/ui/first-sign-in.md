# Path: first sign-in and choosing what to track

Read `README.md` in this folder first.

## Purpose

Someone arrives at githq for the first time, probably from a link or a recommendation, and has never used
it. By the end of this path they are looking at their own work, and they have chosen which repositories and
projects githq should copy in full.

## The user's task

"Let me in with my GitHub account and show me my stuff, without making me configure much."

## What happens, in order

1. **Before signing in.** The user sees what githq is and a "Sign in with GitHub" action.
2. **GitHub's consent screen.** This one is not ours. It will say githq wants "full access to
   repositories" and access to projects. The wording is broad because GitHub has nothing narrower. Our
   screen before it may want to say, briefly, why githq asks for this and that it only touches issues,
   pull requests and projects.
3. **Back in githq: choosing what to track.** githq lists the user's repositories and projects. Their own
   repositories are pre-selected, and organisation repositories are not. The user adjusts the selection and
   continues. This choice can be changed later from anywhere in the app.
4. **First download.** githq copies the chosen repositories and projects. "What concerns me" (my issues,
   my PRs, my review requests) comes first and is small, so it can be usable within seconds while the rest
   continues in the background.
5. **Landing on my work.** The user arrives at the main view of
   [checking what's on my plate](my-work.md).

## What matters on each step

- **Choosing what to track.** The question is: "which of these do I actually work on?"
  - A user may belong to an organisation with hundreds of repositories, so this list can be long and must
    be searchable or filterable.
  - Per repository: name, owner, private or public, and how recently it saw activity. That last one is the
    best hint of whether the user cares.
  - Projects are listed separately: title, owner, and how many items they hold.
- **First download.** The question is: "is it working, and can I start?" Show progress per repository, or
  overall, and let the user move on as soon as their own work is in.

## States

- **An organisation hides its private repositories.** Many organisations block third-party apps until an
  owner approves them, and this is the default for new organisations. The user sees that the organisation
  exists, but none of its private repositories appear. They must be able to see why. The fix happens on
  GitHub: request approval from an owner. Without this, the user will think the app is broken. **This
  failure must be visible.**
- **No repositories at all.** A brand-new GitHub account has none. The user can still use "what concerns
  me" and track other people's projects.
- **Sign-in cancelled or failed** on GitHub's side: the user returns to the start with a short explanation.
- **Signing in again later.** Data from before is still in the browser, so the user lands straight on their
  work, with no download step.

## Questions this design should settle

- How much should the tracking step ask at all? One option is a deliberate step. The other is to skip it,
  track only the user's own repositories, and offer "track more" later.
- Where does "change what I track" live once the user is inside the app?
- How much explanation does the broad permission request deserve before GitHub's consent screen?
