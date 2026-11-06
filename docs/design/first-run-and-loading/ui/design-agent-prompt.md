# Prompt for the design agent: the first run and empty states

Copy everything below the line into the design agent.

---

We're changing how **githq** behaves while it still has data to fetch: the first sign-in loses its download page, the
status bar says what is really still coming, and every empty screen says why it is empty. Work in `githq.pen` in the
worktree you are in, in Direction D.

Read first, in this order:

1. `DESIGN.md`: the rules for changing the file, including the changelog you keep in
   `.context/design/first-run-and-loading.md`.
2. `docs/design/githq/ui/README.md`: what the product is and how the file is organised.
3. `docs/design/first-run-and-loading/ui/first-run-and-empty-states.md`: **the brief for this work.**
4. `docs/design/githq/ui/first-sign-in.md`: the path this changes. Look at its screens in the file (G2, G6, G11) and at
   the frame "App · Freshness" for the status bar.

**What matters most, in this order.**

1. **The four empty-state patterns** — still arriving, nothing there, filtered out, can't be read. Everything else uses
   them, so give them the first and most careful pass, as components. Draw **two or three directions** side by side
   for the set, each shown on the same three places — a full screen (My work), a list's group, a board column — so the
   owner can pick. Make "still arriving" light and alive: the owner's words are "fetching data", "crunching",
   "churning".
2. **The first run, end to end**: the choosing screen in the app's 36px window strip with no step indicator (macOS
   desktop with the window buttons, and web), then My work seconds after "Track these" with nothing arrived, then with
   some groups in and others arriving.
3. **The status bar while downloading**: the left segment telling the progress of everything (expanded sidebar and the
   rail), the sidebar's entries without download percentages, a tracked repository's segment while its closed issues
   arrive, and its "Up to date" once complete. Offline and paused still win the left segment.
4. **Every screen in the brief's table** marked **new** or **fix**, in its state — once the patterns are picked, the
   rest follows the chosen direction.

Retire G6 (the download page): it is no longer part of the path.

Where something has more than one reasonable shape, draw variants side by side with the one you recommend first. The
brief's last section lists the questions these screens have to settle; answer each.

Don't draw what the brief rules out: no "loading more" row at the end of lists, no marker for background refreshes, no
download marker on sidebar entries, no changes to small lines inside panels and pickers.

If a screen forces something the brief doesn't say — a number GitHub would have to supply, a state the app can't tell
apart — don't design around it: note it.

Record your decisions in `docs/design/first-run-and-loading/DECISIONS.md`, following that file's form, and add the
screens' codes to the brief. When you're done, list what you drew, what you decided on your own, and anything still open
with the owner.
