# Prompt for the design agent: commit history

Copy everything below the line into the design agent.

---

We're adding commit history to **githq**: a repository's commits as a graph with its branches and tags, and next to each
commit its pull request and CI state. Work in `githq.pen` in this worktree, in Direction D.

Read first, in this order:

1. `DESIGN.md`: the rules for changing the file, including the changelog you keep in `.context/design/git-client.md`.
2. `docs/design/githq/ui/README.md`: what the product is and how the file is organised.
3. `docs/design/git-client/ui/browse-commit-history.md`: **the brief for this work.**
4. `docs/design/githq/ui/project.md`, "Repository view": the view this changes. Look at its existing screens in the file.

Then draw it in a new frame, **"App · Commits"**, using the components that already exist. The desktop screens go in
**"Desktop · Commits"**.

**What matters most, in this order.**

1. **The shape of the repository view.** Commits becomes a section of it, and today's tabs (All, Issues, Pull requests) only
   filter one list. The owner wants the view generalised and anything no longer needed thrown out. Draw **three distinct
   directions** side by side, each showing Issues and Pull requests as well as Commits, so the owner can pick. This is the
   decision everything else depends on, so give it the first and most careful pass; don't change the old repository frames.
2. **The graph as something you read quickly.** It should be better to scan than a desktop git client, because it also says
   which pull request each commit came from and what is red. Draw it with realistic data: merges, several parallel branches,
   tags, commits with no pull request and no checks, a failing one. Draw one repository with a few branches and one with many.
3. **The walk, by keyboard:** from the repository's issues to Commits, through rows, to a branch by name, into a commit's
   details, to its parent, to its pull request.

**Show, at least:**

- All the screens in the brief's order, on the first direction. Once the owner picks, the rest follows that direction.
- Every state and failure the brief lists, especially the first open of a repository (commits filling in between rows
  already on screen), pull request and CI state not known yet, an old tag whose commit is not loaded, and an untracked
  repository.
- The desktop second step: a local clone with several worktrees as markers and in the list, including one worktree with no
  branch, the actions on a worktree, and adding a folder with its failures. It isn't built yet; it is here to prove the
  first version's layout holds it, so keep it to what proves that.

Where something else has more than one reasonable shape, draw two or three variants side by side, with the one you recommend
first. The brief's last section lists the questions these screens have to settle. Answer each.

Don't draw anything the brief rules out: no files, no diffs, no controls that write to the repository, and no narrowing the
graph to one branch.

If a screen forces something the brief doesn't say, such as data GitHub would have to supply, don't design around it: note
it.

Record your decisions in `docs/design/git-client/DECISIONS.md`, following that file's form, and add the frame's numbers to the
brief. When you're done, list what you drew, what you decided on your own, and anything still open with the owner.
