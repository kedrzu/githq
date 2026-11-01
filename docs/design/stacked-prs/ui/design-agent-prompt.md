# Prompt for the design agent: stacked pull requests

Copy everything below the line into the design agent.

---

We're adding stacked pull requests to **githq**. Work in `githq.pen` in this worktree, in Direction D.

Read first, in this order:

1. `DESIGN.md`: the rules for changing the file, including the changelog you keep in `.context/design/stacked-prs.md`.
2. `docs/design/githq/ui/README.md`: what the product is and how the file is organised.
3. `docs/design/stacked-prs/ui/work-through-a-stack.md`: **the brief for this work.**
4. `docs/design/pr-merge/ui/merge-a-pull-request.md`: the merge path this extends.

Then draw it in a new frame, **"App · Stacked pull requests"**, using the components that already exist.

**What matters most.** The owner gets several stacks of three or four pull requests at a time, mostly from agents, and goes through them one
stack at a time. Stacks must not be mixed with each other in a list, and the list must get shorter because of them. This should feel like the
fastest part of the app, so draw the walk itself: from My work, onto a stack, opening it, stepping through its pull requests with `J`, into the
next stack, and merging.

**Show, at least:**

- My work with several stacks among ordinary rows, collapsed, and one expanded; a stack under an assigned issue.
- A repository's list, and a board by Status with a stack spread over two columns ("2 of 4") and a lone marked card.
- An opened pull request in a stack, with the map, as a panel, a modal and a full page, in a stack of two and of ten.
- The merge panel for a whole stack and stopped partway, in the states from the brief.
- Every state and failure the brief lists, especially a stack needing a rebase, since it is common and blocks everything.
- Link, add and dissolve.

**Merging screens already exist.** They are in **"App · Merging a pull request"** (`LLr2k`): the stack states are PM17, PM18 and PM24b. Redo them
in the new frame, and don't change the old frame. The owner has not yet picked among that frame's variants, so build on its recommended ones:
the panel as its own surface (PM1a, PM2a), and it leaving once GitHub accepts (PM32a). Note two changes from those screens: with two or more
pull requests there is no commit text, and the words are "earlier" and "later", not "below". Update the "Being merged" row only if a stack
needs something different.

Where something has more than one reasonable shape, draw two or three variants side by side with the one you recommend first, and the owner
will pick. The brief's last section lists the questions these screens have to settle. Answer each.

If a screen forces something the brief doesn't say, such as data GitHub would have to supply, don't design around it: note it.

Record your decisions in `docs/design/stacked-prs/DECISIONS.md`, following that file's form, and add the frame's numbers to the brief, as the
merge brief has in "The screens". When you're done, list what you drew, what you decided on your own, and anything still open with the owner.
