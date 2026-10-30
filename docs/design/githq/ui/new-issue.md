# Path: creating an issue

Read `README.md` in this folder first.

**Status:** designed in Direction D (screens H1–H9).

## Purpose

The user remembers something that needs doing, or spots a bug, and wants to write it down **before the
thought is gone**. Most often this happens in the middle of something else: on "my work", inside a
project, or while reading another issue. Creating an issue must be as fast as the rest of the app.

## The user's task

"Let me type a title, maybe a few lines, put it in the right repository, and get back to what I was doing.
Details can come now or later."

## What happens, in order

1. **Start creating,** with one key from anywhere, or from the command menu. Where the user starts sets
   sensible defaults:
   - **in a project**: the issue is added to that project, and if the user started in a group (e.g. the
     "In progress" column), it gets that field value;
   - **in a repository**: that repository;
   - **from an open issue**: offer to make it a sub-issue of that issue;
   - **from my work**: the repository used last.
2. **Choosing the repository.** This is required, because a GitHub issue always belongs to one repository.
   The tracked repositories come first, but any repository the user can create issues in is allowed. Pick
   it from the keyboard by typing part of its name.
3. **Title.** This is the only other required thing.
4. **Optionally, more details:**
   - body (GitHub-flavoured markdown);
   - assignees (defaulting to nobody, with "assign to me" one key away);
   - labels, milestone and issue type, using the options of the chosen repository;
   - parent issue;
   - projects, and their fields.
5. **Create.** The issue appears at once wherever it belongs, and GitHub assigns its number a moment later.
   The user is back where they were. Offer "create another" for writing several in a row.

## What matters

- **Speed for the common case.** Repository plus title, then Enter, must take seconds. Everything else is
  secondary and must not get in the way.
- **The repository decides what's available.** Labels, milestones, issue types and who can be assigned all
  differ per repository. Changing the repository after picking labels means some of them may not exist
  there.
- **Issue templates.** Many repositories define issue templates on GitHub: plain markdown templates, or
  structured forms with fields such as "steps to reproduce" and "version". Contributing to someone else's
  project often requires using them. Show how a template is offered and filled in. For forms, it's fine to
  show the form as a pre-filled markdown body rather than a real form in the first version.

## States

- **No permission to create issues** in the chosen repository, or issues disabled in it. Explain this
  before the user has written anything, not after.
- **Creation rejected by GitHub** after the user wrote the issue. Keep the text and show the reason.
  **Must be visible, and must not lose the text.**
- **A draft that was never sent** because the user closed the window. Nice to have, not required.

## Questions this design should settle

- One screen, or a compact quick-capture that can expand into a full form?
- How does a draft issue in a project (already designed: "New draft issue") relate to this? Same entry
  point with "no repository" as an option, or separate?
