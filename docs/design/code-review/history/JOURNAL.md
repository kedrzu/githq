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
