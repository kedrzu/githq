# Designing githq

Rules for an agent changing the design file, `githq.pen`, in the Pen app or connected through its MCP. Design
happens on one branch, usually by several agents at once, and coding agents on other branches build from it.

How the file is organised and what the product is: `docs/design/githq/ui/README.md`. Design decisions still go
in `docs/design/githq/DECISIONS.md` and `JOURNAL.md`; the changelog below does not replace them.

## Components

`githq.pen` is built from components, so a change made once reaches every screen. Keep it that way.

- **Nothing drawn twice by hand.** UI that repeats becomes a component first, then gets instanced. Before
  drawing something, look for an existing component.
- **A hierarchy, each level made of instances of the one below:** atoms (key, avatar, label, status, button,
  hint, chip, tab, menu section) → parts (rows, headers, menu items) → panes and panels → screens. The shared
  ones are in "App · Components"; those of one aspect are in a `Components · …` frame at the top of its frame.
- **Instances override content and state only:** text, icon, colour, visibility (`enabled: false`). An
  overridden property stops following the component, so never override layout or styling (padding, gap, size,
  font). Different styling is a different component.
- **Variants inherit.** A component can itself be an instance of another component: make a variant that way,
  so the base's padding, type and colours stay in one place.
- **Names say what it is and which variant:** `Button / icon, label`, `List row / PR · checks`.
- **A change to a component changes every screen that uses it.** Look at a few of those screens afterwards.
- **Turning copies into instances** (when tidying): swap a copy only for an instance that resolves to the same
  tree, overriding what differs; when the swapped node sat inside another component, move the instances'
  overrides that pointed into it to its new path; compare the resolved trees before and after. Do the reads
  first and the writes after: reading between writes is slow on a file this size.

## Naming screens, variants and questions

The owner reviews the file by scanning the canvas and searching it, and the briefs, `DECISIONS.md` and changelogs
cite screens by code. So a screen's name says which screen it is, and whether a decision is waiting on it.

- **Every screen has a code: its aspect's letters and a number,** e.g. `PM12`, `W4`. Each top-level aspect frame
  has its own letters (`PM` merging, `W` workflows, `T` settings); read them off the frame before adding a screen,
  and give a new aspect letters no other aspect in the file uses. A code is unique across the file.
- **A new screen takes the next number in its aspect, and a code is never reused or changed,** even after its
  screen is deleted, because documents cite it. A letter suffix (`K1b`, `PM24b`) is not a code: another state of a
  screen is a new number. Codes already in the file stay as they are.
- **Code and title read the same everywhere:** the slot (`Slot · W2 · Everything broken`), its caption title
  (`W2 · Everything broken`) and the screen frame inside it.
- **Variants of one question sit together in one frame named `Variants · <the question>`,** e.g.
  `Variants · How an issue is created`, and each screen in it is titled `<code> · Variant A · <what it is>`:
  `H3 · Variant A · Quick capture`. A variant drawn over several screens gives each screen its own code and the
  same letter. Variant A is the one you recommend, and its caption says so. "Variant" appears in no other name, so
  searching for it lists exactly what is still to be picked.
- **Something else for the owner to settle,** an open question or a guess the brief didn't cover, puts
  `Question ·` before the title (`K10 · Question · Who sees a hidden repository`) and the question in the caption.
- **Both are amber, so they show from far away:** the `Variants · …` frame, or the slot of a question, gets the fill
  `#D299221A`, the stroke `#D29922` at 2 px and 24 px of padding. No other frame around screens is amber, so an
  amber frame always means "the owner decides here".
- **Once the owner picks,** delete the rejected variants (git history and `DECISIONS.md` keep them), move the
  chosen screens out of the `Variants` frame, delete that frame, and drop `Variant A ·` from their titles. The codes
  stay. A settled question loses `Question ·` and its amber. Changelog entries record the renames too.

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
