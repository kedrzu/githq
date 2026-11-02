# Prompt for the design agent: a repository's ref patterns

Copy everything below the line into the design agent.

---

We're continuing work on the GitHub Actions screens of **githq** in `githq.pen`, on the branch
`design/improve-ui-designs`, where the `W` screens already are. Read and follow `DESIGN.md` before touching the file.

The brief is `docs/design/actions/ui/failing-workflows.md`. Screens 1 to 4 of it are drawn. This round is
**screen 5, a repository's ref patterns**, which the brief has just been expanded with. Re-read the whole brief
first, especially "Terms" and screen 5; the rest of the design is in `docs/design/actions/README.md` if you need the
reasons.

In one paragraph: a broken workflow lights a red marker on its repository in the sidebar and adds to a total. By
default only failures on the repository's default branch do that, so the failures on the branches someone is working
on do not distract them. Runs started by a pull request never count. Screen 5 is where a repository adds other
branches and tags with wildcards (`v*`, `release/*`, in the syntax of GitHub's own workflow files), or switches the
default branch off. It only decides what lights the counters: the Workflows tab keeps showing every workflow and run.

What to draw:

1. **The screen itself**, in every case the brief lists under screen 5: the default, `main` plus `v*` with the refs it
   matches (tags and one branch it catches by accident), a pattern that matches nothing yet, everything switched off,
   and a repository not read yet.
2. **Adding and editing a pattern**, by keyboard, including what the user sees while typing: what the pattern
   matches, updated as they type.
3. **The way in from the Workflows tab** (`W` screens). Also show where a workflow row tells the user that its
   failures do not count here, if it needs to, so the reason a red row lights nothing is never a mystery.
4. **Where it lives.** githq now has a Settings screen listing tracked repositories (the `T` screens). Decide whether
   per-repository settings belong there, opened from the Workflows tab, or in the tab itself. If you are unsure, draw
   both as variants in an amber `Variants · …` frame and recommend one.

Constraints that are facts, not taste:

- The default branch is whatever GitHub reports for the repository, shown by its name. It is a switch, not a pattern
  the user typed and can edit.
- One list of patterns for branches and tags. `*` matches anything except `/`, `**` matches anything.
- What a pattern matches can only come from runs githq has already seen. Say so where it matters; never imply it is
  the full list of branches.
- Nothing on this screen says whether settings are saved to GitHub; that is handled by Settings for all of them.

Give every new screen the next free `W` code (or `T` code if it lands in Settings), and leave a changelog entry as
`DESIGN.md` describes.
