# Empty states unified

Every whole-screen empty note is drawn by one component, `Empty / Note · screen`, in the look the Workflows screens
had (first run and loading D19), with the copy the app ships. Base: `0c09818f`.

## Round 1 · agent brief, made during implementation

Forced by: the code moved every empty state onto one `EmptyState` (PR #293); the file had the smaller shared note, a
separate `Workflow / Empty state` and hand-drawn notes. Asked: redraw the component, add tone components, swap every
hand-drawn note for an instance with the shipped copy.

- [x] `Empty / Note · screen` (`hk0U0`): 640×380, icon 26, title 18/600 → a 460 wide stack, gap 16: icon 40 at a thin
  stroke in `$fg-2`; `Copy` (`u06W4`, gap 6) with the title 15/500 `$fg` and the line (`QFwBj`) 13 px, 1.5, `$fg-2`;
  new `Fact` chip (`Yt5tW`) in `$mono` 11.5 `$fg-dim` on `$bg-2`, `$border`, radius 6, hidden by default; new
  `Actions` row (`vFbwf`, gap 8) with three button instances, hidden by default.
- [x] New tone components in `mbBID`: `Empty / Note · screen · good` (`l59zd`), `· warning` (`IEXvI`), `· broken`
  (`U0Ytgx`), overriding only the icon colour.
- [x] `Empty / Nothing there · screen` (`pdwuQ`), `Empty / Filtered out · screen` (`p8xfZR`), `Empty / Can't be read ·
      screen` (`PizV0`): new copy and chips ("No issues. Suspiciously clean.", "Filtered down to zero" `18 → 0`,
  "You're offline" `api.github.com → unreachable`).
- [x] `Reason · Nothing there` (`jCAvU`), `Reason · Filtered out` (`NUHW3`), `Reason · Can't be read` (`KP2EE`): their
  full-screen notes are instances in a centring `Message` frame.
- [x] Deleted `Workflow / Empty state` (`UljqM`) and `Changelog / Message` (`McHUU`): no instances left.
- [x] Workflows: every `UljqM` instance is an instance of the new component with the same copy and chip — W2b
  (`zC1q1`, good), W3d (`PREZS`), W3e (`EiRRf`), W4g (`wtPYG`), W20 (`IExTO`, "No repositories tracked yet"), W24
  (`bHmYr`, warning), W25 (`TIbKS`), W26 (`yfRuC`, warning), and besides the brief J7 (`hvyz8`), W4f (`fcang`,
  broken), W4i (`FDQ9T`), W4j (`MQbCt`), W16 (`w9AUD`), W17 (`HEIM6`), W22 (`g0daEA`), W23 (`BHCp5`). Try again
  shows rotate-cw and ↵.
- [x] ES11 (`P8zuKk`, `13 → 0`), ES12 (`j3uuPd`, "Nothing in Mentioned, for now"), ES13 (`F2avT`, offline chip), ES16
  (`OcFCY`), ES17 (`f9mjuo`), ES22 (`ywSdf`, `retry after 14:20`), ES23 (`cCaOz`), ES24 (`nVkj7`, "No repositories
  tracked yet"), ES19 (`oESiA/x9H9F`): instances.
- [x] ES25: a new `Fact` column (`gJ9o5`, rows `p0yq9`, `VJxRy`, `RARnh`, `Ruh0N`); the Line column 560 → 340.
- [x] K4 (`Bo481`, "Inbox zero. Savour it.", chip, New issue · C, Jump to a project · ⌘K), K5 (`iAIQi`, good, the
  waiting pointer `JuxVf` kept below), K8 (`fKK94`, "… is a blank canvas", `items: 0`), K9 (`WJzV2`, good), CH38
  (`sAmRT`, "A blank slate", `git log → no commits yet`), CR64 (`t8qHJy`, "Nothing to diff", Conversation and Open
  on GitHub), CR80 (`TbEEr`, warning).
- [x] U45 (`s20SGC/AUnsG`, `stable: none · next 0.1.0`), U47 (`QI6Ls/RJY0E`, "You're offline"), U48 (`uLqXE/Xfiue`,
  "GitHub isn't answering"); U44 (`S4sq9b/C31f4m/fJVhg`): an `Empty / Note · column` with the commit count.
- [x] G10 title (`wEfc6`): "A fresh account, no repositories yet".
- [x] MB96 (`j6qIGp`, good), MB208 (`WHv8u`; frame `n4YW6N` padding 0/24/80/24), MB209 (`F35gWF`, good; frame `Ozbfg`
  the same): instances filling the phone's width.

Left as they are: W19 (a line in a row, not a whole-pane note), CR65 and CR67 (per-file placeholders), MB66 (a line in
the Places panel). Pen has no `flex-wrap`, so the drawn action row doesn't wrap as the built one does.

## Round 2 · agent brief, made during implementation

Forced by: two left-aligned mobile pages kept titles the app no longer says. Changed: their titles only.

- [x] MB138 title (`EwVA2`): "You have no repositories yet" → "A fresh account, no repositories yet".
- [x] MB162 title (`I4KHU`): "You track no repositories" → "No repositories tracked yet".
