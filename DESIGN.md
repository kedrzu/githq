# Designing githq

Rules for an agent changing the design file, `githq.pen`, in the Pen app or connected through its MCP. Design
happens on one branch, usually by several agents at once, and coding agents on other branches build from it.

How the file is organised and what the product is: `docs/design/githq/ui/README.md`. Design decisions still go
in `docs/design/githq/DECISIONS.md` and `JOURNAL.md`; the changelog below does not replace them.

## The changelog

Keep a changelog of what you change, so a coding agent can build it without being told what to look for.

- **One file per feature:** `.context/design/<feature>.md` in the worktree holding the document, named in
  kebab-case after the feature, e.g. `context-menu.md`. Look in the folder first: continue your feature's file
  if it exists, and leave other features' files alone, because parallel agents are writing them.
- **The first line is the document's absolute path.** Worktrees have separate copies of the file.
- **Record every change, however small,** in the same turn you make it. A small colour change next to a new
  screen is exactly what gets missed.
- **An entry is an unticked box:** where (frame or component, and node id), what changed, before and after.

```markdown
Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/some-worktree/githq.pen

- [ ] App · Menus (`aB3xY`): new repository menu, opened from the repository's name in the toolbar.
- [ ] Item / Toolbar (`I6JTP`): gap between buttons, 6 → 8. It's a component, so every item view changes.
```

- **Reversing a change:** correct or remove its entry while it is unticked. A ticked entry has been built, so it
  stays, and the reversal is a new entry.
- **It covers what agents change.** The owner's own edits on the canvas are not in it unless they tell you about
  them; then record them too.
- **It is not committed and disappears with the worktree,** because `.context` is gitignored. Keep the design
  worktree until its changelogs are built.

## Implementing from a changelog

For a coding agent told that a changelog is on a given worktree:

1. Look in that worktree's `.context/design/`. Take the file for your feature; if it isn't clear which one that
   is, ask.
2. Read the design from the document on the file's first line, not from your own copy of `githq.pen`, which may
   be behind. Check with `get_app_state` that it is the active document, and pass its path to the tools. If you
   can't reach it, ask the owner to open it.
3. Build every unticked entry, the small ones too.
4. Tick each entry in that file as you build it, so the next agent knows what is left.
5. Say in your reply what you left unticked and why.
