# Journal — code review in githq

Append-only. One line per turn that produced a decision, a rejection or an answer from the owner.

- 2026-11-02 — Owner opened the design: code review inside githq, better and faster than github.com. Stated
  requirements (owner's words, translated): virtualization that does not jump to the wrong place when clicking a
  comment; see the PR's own conversation (comments attached to the PR, not to code) while reading the diff, in a
  sidebar that can be toggled — on on large screens, off on small; full screen only, no modal or side panel;
  split and unified views as on GitHub; hide whitespace changes, remembered instead of unticked on every PR;
  switching between PRs of a stack in one click or a shortcut / command menu; remember the scroll position per PR
  when switching, to get back to where one was reading. Context: githq D6 kept review on github.com; stacked-prs
  D9 said review would build on opening a PR with its stack map. Agent dispatched a check of GitHub's diff and
  review APIs (limits, whitespace, review mutations). Nothing folded into a story yet.
- 2026-11-02 — API check back: no whitespace-ignoring diff in any GitHub API; pulls/files caps at 3000 files, patch
  limits undocumented; GraphQL changed files carry no diff text but have viewed state; all review-writing mutations
  exist incl. pending reviews; REST and raw.githubusercontent.com allow CORS. Recorded as evidence under Q1 (where
  the diff comes from) and Q2 (read only or write). Asked owner: read vs write in v1, sidebar toggle vs automatic.
- 2026-11-02 — Owner: write reviews in v1 → D1 (Q2 closed); full screen only → D2; split + unified → D3; whitespace
  hiding remembered → D4 (per device: agent's reading); PR conversation in a sidebar toggled by hand → D5. Owner
  wants context lines around each change, expandable, and very large diffs probably collapsed → agent recorded
  computing the diff ourselves as D6 (Q1 closed), large diffs open as Q3. Owner raised that jumping to a line
  depends on what is expanded/collapsed and comments have unpredictable height; proposed estimate-and-correct.
  Agent proposed anchoring on the target instead → open as Q4. Story not written yet.
- 2026-11-02 — Owner agreed to anchoring on the target → D7 (Q4 closed). Owner asked whether computation should move
  to a Web Worker or WebAssembly (github.com stutters on large PRs) → Q5 with agent's proposal (per-line
  virtualization, diff + highlighting in a Web Worker, WASM only on measurement). Q3 updated: agent proposes
  collapsing by kind and viewed state rather than size; GitHub's APIs don't say which files are generated.
- 2026-11-02 — Owner: generated files (lock files, .gitattributes) collapsed by default, and very large files too
  ("not only for performance") → D8 (Q3 closed; size threshold unset). Owner wants GitHub's viewed mark and filters
  like github.com, hiding viewed files so the list shrinks → D9. Asked: does hiding viewed act on the file list only
  or also on the diff; which other filters.
- 2026-11-02 — Owner: with viewed filtered out, marking viewed removes the file from both list and diff, as on GitHub;
  the jump is fine (next file takes its place) → D9 sharpened, agent's collapse-in-place rejected. Owner wants
  multi-select in the file list (Shift+click range, Cmd+click add) to mark many viewed at once, and the viewed state
  shown in the list (icon or colour to the designs) → D10. Unanswered: file list hideable as a remembered switch;
  which filters besides viewed.
