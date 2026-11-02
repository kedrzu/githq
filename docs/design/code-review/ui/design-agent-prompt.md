# Prompt for the design agent: code review

Copy everything below the line into the design agent.

---

We're bringing code review into **githq**: reading a pull request's changes file by file, every comment where it
belongs, and later writing comments and submitting reviews. Work in `githq.pen` in this worktree, in Direction D.

Read first, in this order:

1. `DESIGN.md`: the rules for changing the file, including the changelog you keep in `.context/design/code-review.md`.
2. `docs/design/githq/ui/README.md`: what the product is and how the file is organised.
3. `docs/design/code-review/ui/review-a-pull-request.md`: **the brief for this work.**
4. `docs/design/stacked-prs/ui/work-through-a-stack.md`: the stack map and walking a stack, which the review builds on.
   Look at its screens in the file.

Then draw it in a new frame, **"App · Code review"**, using the components that already exist.

**What matters most, in this order.**

1. **Reading a long diff calmly.** This screen replaces github.com's "Files changed" for someone who reviews a lot
   every day, mostly agents' pull requests in stacks. Draw it with realistic data: a pull request of about 40 files,
   including a lock file and generated code (collapsed), several viewed files, a renamed file, a binary file. Use
   real-looking code with comment threads: one ordinary, one resolved, one outdated placed approximately, one on a
   line inside collapsed context, one in a collapsed file, and one on a file deleted from the diff. Draw it in split
   and in unified.
2. **The open draft review.** It must be impossible to miss on the review, marked in lists, and an entry in the
   sidebar while any exists. This is the owner's sharpest pain: a draft started without noticing blocks the agent on
   the other side.
3. **The walk, by keyboard:**
   - from an opened pull request into its review;
   - through files with `[` / `]` and threads with their own keys;
   - ticking files viewed, with viewed files hidden, so the list shrinks;
   - selecting ten files and ticking them at once;
   - `J` to the next pull request of the stack and `K` back to the exact place you were reading.

**Show, at least:**

- All the screens in the brief's order, including the second step (writing a comment, in both settings and with a
  draft open; submitting a review; the setting in the settings screen).
- Every state and failure the brief lists, especially the first open of a large pull request with files still
  arriving, everything viewed, the 3,000-file cut-off, and a file that could not be fetched.
- The conversation sidebar on and off, on a large screen and on a laptop.

Where something has more than one reasonable shape, draw two or three variants side by side, with the one you
recommend first. The brief's last section lists the questions these screens have to settle. Answer each.

Don't draw anything the brief rules out: no review in a side panel or modal, no applying suggestions, no combined
diff across a stack.

If a screen forces something the brief doesn't say, such as data GitHub would have to supply, don't design around
it: note it.

Record your decisions in `docs/design/code-review/DECISIONS.md`, following that file's form, and add the frame's
numbers to the brief. When you're done, list what you drew, what you decided on your own, and anything still open
with the owner.
