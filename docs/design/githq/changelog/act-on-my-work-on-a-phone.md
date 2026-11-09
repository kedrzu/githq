Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

Brief: `docs/design/mobile/ui/act-on-my-work-on-a-phone.md`. Everything is inside `App · Mobile` (`jy6bO`). Screens (`pM9rS`) are drawn on the recommended
variants; every amber `Variants · …` frame and the amber slot of MB89 still waits for the owner's pick, so build those only once picked.

## Components (Components · Mobile → `Acting on My work`, `oiITu`)

- [ ] Phone / Row (`pFppk`), base of every phone row: new children in `Meta` (`Y8AnMz`), all off by default, so no existing screen changes:
      `Field` (`YvlXC`: dot `mt12T`, value `csCon`, "+1" `Iki8G`) after the reference; `Label dots` (`V5gyw`: `B34G7`, `EHtBT`, `VyqSQ`, 7 px colour dots)
      after the label; `Closing PR` chip (`rB8pJ`: PR icon, `#1205`, check); `Draft` text (`HQCKG`) after Review. Order now:
      Reference · Field · Label · Label dots · Closing PR · Checks · Review · Draft · spacer · Avatar · Updated.
- [ ] Rule for the row at a phone's width (proposed in MB89's caption): reference drops the owner when the repository is tracked (`webapp#1187`),
      keeps it when not (`vitejs/vite#19021`); the project's row field with +N; labels as colour dots only, names in the item; one avatar; checks and
      review for a PR; "Draft" in place of review for a draft.
- [ ] New rows (`k2azRH`): `Phone / Row / Issue · field, labels, assignee` (`YweAu`), `Phone / Row / PR · checks, review, author` (`Y53KA`, on `ME4y9`),
      `Phone / Row / PR · draft` (`a450v`), `Phone / Row / Issue · closing PR chip` (`AQeuB`, variant B of nesting),
      `Phone / Row / Nested PR` (`U1Ipg`: corner-down-right, PR icon, `#1205`, one clipped line of title, checks; indented 22 px),
      `Phone / Row / Nested PR · full row` (`G2Nsl`, variant C, 26 px indent).
- [ ] `Phone / Segment` (`BxGQw`), `· current` (`y1sXt`, `$sel` fill, `$accent` stroke), `Phone / Filter strip` (`VtYLv`, Needs me current) and
      `Phone / Filter strip · All` (`AjJ5s`): the My work filters under the top bar (MB89, a question).
- [ ] `Phone / Summary chip` (`mtoXC`): 30 px chip, `$bg-2`, 8 radius; optional avatar, dot, label dots, icon, text, sub, chevron.
- [ ] `Phone / Property summary · issue` (`Mg3Qu`), `· pull request` (`ZgPo0`, branches line + reviewers, size, ⋯ / status, closes, assignee),
      `· pull request, stacked` (`G3WRT`, Stack 2 of 4 chip first).
- [ ] `Phone / Where it stands` (`Pv3sV`, failing check with Log ↗) and variants `· waiting for review` (`Rir6O`), `· ready` (`BSocv`, Merge ↗),
      `· conflicts` (`QVCVx`, Resolve ↗), `· changes requested` (`G2sL42`), `· checks failing` (`AfKnp`, opens the checks).
- [ ] `Phone / Check row` (`N1d0ew`), `Phone / Timeline gap` (`G0HyHM`, "74 earlier events · Show"), `Phone / Timeline · new since you looked`
      (`vpKWS`), `Phone / Body placeholder` (`OpGLL`), `Phone / Stack strip` (`yjxbJ`), `Phone / Stack member` (`k6Bc5u`) and `· current` (`pDWAG`).
- [ ] `Phone / Popover / Labels` (`buTBe`, variant B of changing a property), `Phone / Row / Selectable` (`S2UMc`) and `· selected` (`h9ZxKZ`),
      `Phone / Row / Swiped` (`fzBjl`, variant B of row actions).
- [ ] Sheets (`wAWLx`): `Phone / Command sheet / Labels · picking` (`xBrsD`, multi-select, no keyboard until search is tapped),
      `… / Reviewers · picking` (`kdXH0`), `… / Close · from below` (`lBgtP`, completed / not planned), `… / Row · long press` (`O65RZJ`),
      `… / Pull request · draft` (`LaXFd`, Ready for review nearest the thumb), `… / Selection · three items` (`Cz3JY`),
      `Phone / Sheet / Every property` (`RG8Uv`, every project with all its fields, Add to a project), `Phone / Sheet / Checks` (`MZluT`),
      `Phone / Sheet / Stack` (`NcUYf`, Merging the stack ↗). Superseded: see `phone-brought-back-to-the-desktop.md` (Labels, Reviewers and Close · picking deleted; `Phone / Menu / Labels`, `/ Reviewers`, `/ Close` replace them).
- [ ] Panes (`uxlOF`): `Phone / List / My work · Needs me` (`l2aPa4`), `… · All, further down` (`O0qzLh`), `Phone / Item / Issue · summary` (`qZhtg`),
      `Phone / Item / Pull request · summary` (`j4OTf`), `… / Issue · properties after the body` (`Aj50h`), `… / Pull request · long thread` (`EkP8V`),
      `… / Issue · arriving` (`e1palS`), `… / Issue · reply sent` (`aUYA5`), and the three stacked panes `U05wa2`, `GSjJM`, `M8C99S`.
- [ ] Counts in the new panes: Needs me 8 = Review requested 2 + My pull requests 1 (failing checks) + Assigned to me 5; All 13 = 2 + 3 + 5 + 3.
      #1205 is nested under #1187 and counted nowhere.

## Screens (`pM9rS`)

- [ ] MB89 · Question · My work, filtered to Needs me (`v365q`, amber slot): the filter strip, and the row at a phone's width.
- [ ] MB90 · My work · All, further down (`Vs58j`): draft row, untracked references, nested PR, Mentioned.
- [ ] MB91 · Replying · Keyboard up (`e6v442`), MB92 · Replying · Sent (`TLVn1`): comment appears at once with "now", box empty, ⌘ back.
- [ ] MB93 · Back to My work, at the same row (`Q71WbA`): the opened row and its nested line lit.
- [ ] MB94 · An edit GitHub rejected (`dPvvQ`): chip reverted, toast "Label docs not added to #1187: …" with OK. Toast action of that instance "Retry" → "OK".
- [ ] MB95 · The body and activity not here yet (`cDcjK`): title and properties at once, body and comments as placeholders.
- [ ] MB96 · Nothing needs me (`Z8Pci`): strip with Needs me 0, empty note "Nothing needs you".
- [ ] MB97 · A very long thread (`RnDn2`): first event, "74 earlier events · Show", "3 new since you looked" divider, "↓ 3 new" pill above the line.
- [ ] MB98 · A pull request · Its checks (`jcNAD`), MB99 · A pull request · Ready for review (`h4L9nQ`).

## Variants (`wKAWs`), each `Variant A` recommended

- [ ] Variants · How a pull request nested under its issue reads in a row (`z5gop`): MB100 A one indented line, MB101 B a chip on the issue's row, MB102 C the full row indented.
- [ ] Variants · How the properties sit on an item (`A5lyuq`): MB103 A summary line · issue, MB104 A · pull request, MB105 A every property, MB106 B all at the top, MB107 C after the body.
- [ ] Variants · How a property is changed (`X85aVB`): MB108 A a chip opens the command menu at its picker, MB109 A closing, MB110 A requesting a reviewer, MB111 B a picker of its own, MB112 C only through ⌘.
- [ ] Variants · Acting on a row without opening it (`M1fwt`): MB113 A long press opens the command menu at the row, MB114 B swipe, MB115 C nothing.
- [ ] Variants · Selecting several items (`g1Xbwf`): MB116 A not in the first version, MB117–MB119 B Select from the list's options (selecting, acting on three, one of three failed).
- [ ] Variants · Where a pull request's place in its stack goes (`H9ZDbK`): MB120 A a chip in the summary, MB121 A the stack opened, MB122 B a strip, MB123 C a section.

## Not changed

- [ ] MB80 and the other earlier list screens still use `Phone / List / My work · All` (`B9fFBr`) with full references and label pills. Once MB89's row is
      picked, that pane should move to the new rows; not done here because it changes settled screens. Superseded: see `phone-brought-back-to-the-desktop.md` (`B9fFBr` now carries the current rows and the strip).

## Owner's picks, round 2 (D23–D27 in `docs/design/mobile/DECISIONS.md`)

- [ ] MB89 settled (D23): `Question ·` and amber dropped from slot `FYF00`, caption title and screen `v365q`, renamed `MB89 · My work, filtered to Needs me`, caption rewritten.
- [ ] MB100 picked (D24): renamed `MB100 · One indented line under the issue` (`Jeq3K`), moved to Screens row 2 (`lDRTs`). Frame `z5gop` deleted with MB101–MB102.
      Deleted as unused: `Phone / Row / Issue · closing PR chip` (`AQeuB`), `Phone / Row / Nested PR · full row` (`G2Nsl`), and the `Closing PR` child (`rB8pJ`) of `Phone / Row` (`pFppk`). Entries above naming them no longer apply.
- [ ] MB114 picked (D27): renamed `MB114 · Swiping a row reveals actions` (`LA3Ov`), now swiping #1190 (visible above the line), moved to Screens. Frame `M1fwt` deleted with MB113, MB115; `Phone / Command sheet / Row · long press` (`O65RZJ`) deleted.
- [ ] Properties as rows (D25). Components rebuilt in place, so every pane using them changed:
      `Mg3Qu` is now `Phone / Properties · issue` (Assignees, Labels, Status · Platform Q4, More), `ZgPo0` `Phone / Properties · pull request` (Reviewers, Checks, Status, More),
      `G3WRT` `Phone / Properties · pull request, stacked` (Stack row first). Padding 0, gap 0; the chips are gone.
      New: `Phone / Property · more` (`gKSlh`: chevron-down, "More", one line of what else), `Phone / Property · fewer` (`DYbxw`), `Phone / Properties · issue, every property` (`k9uHBB`: type, milestone, sub-issues, a section per project with all its fields, Add to a project, Fewer), pane `Phone / Item / Issue · every property` (`D4CI1`).
- [ ] `Phone / Property` (`VILkz`): spacer and a `›` chevron (`O7y1g`, 16 px, `$fg-3`) at the end, so every property row reads as tappable. A component: every property row changes.
- [ ] Settled panes changed to match D25: `Phone / Item / Issue` (`Z50g0`) — its five property rows replaced by one `Phone / Properties · issue`; `Phone / Item / Pull request` (`PWGSV`) — Branch, Reviewers, Checks, Size, Closes, Status rows replaced by `Phone / Where it stands · waiting for review` and `Phone / Properties · pull request`; the GitHub link row stays. So MB33, MB35, MB38, MB52, MB60, MB62, MB70–MB74, MB82 change.
- [ ] The 1 px `Rule` under the properties deleted in panes `qZhtg`, `j4OTf`, `e1palS`, `EkP8V`, `U05wa2`, `GSjJM`, `M8C99S` (the rows carry their own border). Property instances re-overridden in `e1palS`, `EkP8V` and MB99's pane.
- [ ] New screens in Screens row 3 (`IkGNm`): MB124 · An issue, opened; MB125 · An issue, every property; MB126 · A pull request, opened.
- [ ] Frame `A5lyuq` deleted with MB103–MB107 (codes retired); deleted as unused `Phone / Summary chip` (`mtoXC`), `Phone / Sheet / Every property` (`RG8Uv`), `Phone / Item / Issue · properties after the body` (`Aj50h`).
- [ ] Changing a property (D26): MB108, MB109, MB110, MB112 renamed `MB1xx · Changing a property · Tapping it / Closing / Requesting a reviewer / Through ⌘`, moved to Screens row 3, captions rewritten. Frame `X85aVB` deleted with MB111; `Phone / Popover / Labels` (`buTBe`) deleted.
- [ ] Sheets fitted to their content: `Labels · picking` (`xBrsD`), `Reviewers · picking` (`kdXH0`), `Close · from below` (`lBgtP`), `Pull request · draft` (`LaXFd`), `Selection · three items` (`Cz3JY`): height fit_content, results fit_content with padding 6 / 8 — no empty band under the head, no row pressed against it. Superseded: see `phone-brought-back-to-the-desktop.md` (Labels, Reviewers and Close · picking deleted).
- [ ] Still amber: Selecting several items (`g1Xbwf`, MB116–MB119) and Where a pull request's place in its stack goes (`H9ZDbK`, MB120–MB123); MB120 is now `Variant A · A row in the properties`, captions of MB116, MB122, MB123 updated.
- [ ] Selecting several items settled (D28): MB117–MB119 moved to the new Screens row 4 (`V6j1iq`) and renamed without
  `Variant B ·`; MB116 and the frame `g1Xbwf` deleted. Build MB117–MB119.
- [ ] A pull request's place in its stack settled (D29): MB122 · A strip under the top bar moved to Screens row 4 and
  renamed; MB120, MB121, MB123 and the frame `H9ZDbK` deleted. `Phone / Stack strip` (`yjxbJ`): its arrows were ↓ ↑
  ("Below", "Above"), now ← → ("Previous" towards the base, "Next"), caption rewritten. Deleted as unused:
  `Phone / Item / Pull request · stacked, in the summary` (`U05wa2`), `… · stacked, a section` (`M8C99S`),
  `Phone / Sheet / Stack` (`NcUYf`), `Phone / Properties · pull request, stacked` (`G3WRT`), `Phone / Stack member`
  (`k6Bc5u`) and `· current` (`pDWAG`).
- [ ] New question, amber: `Variants · Which properties are rows and which are chips` (`wKAWs`, the former
  `Variants · Acting on My work`): MB127 A chips under the title, MB128 B chips after the rows, MB129 C chips after the
  body, MB130 A on a pull request. Waiting for the owner's pick; nothing to build yet.
- [ ] Variants · Which properties are rows and which are chips (`wKAWs`), the owner's follow-up on Variant A ("how are the chips edited, is there a view of every property"):
      an `… All` chip (ellipsis icon, `Chip all`) added at the end of the last chip line in MB127 (`Dpe8K`) and MB130.
      New MB131 · Variant A · Changing a chip (`SlfPG`): MB127 under a scrim with `Phone / Command sheet / Labels · picking` — a chip opens its step as a row does (D26).
      New MB132 · Variant A · Every property (`Wfk7A`): All unfolds every property in place as rows (`Phone / Properties · issue, every property` without its Labels row; empty fields shown, Iteration "None"), the chip turns into `Fewer` (chevron-up, `$accent` stroke, `$sel` fill). Not built until the owner picks.

## Owner's pick: rows, then chips, with a chevron (D25 rewritten)

- [ ] New `Phone / Chip` (`oEda7`): 12 radius, `$border-2` stroke, padding 3 / 8; optional dot (`l3ZA4`), icon (`j5WbT`, 12 px `$fg-dim`), text (`X1Ffj`, 12 px `$fg-2`).
- [ ] New `Phone / Property chips · issue` (`EywvE`) and `· pull request` (`ozxE4`): the chips in lines on the left, a 44 px chevron-down button (`Phone / Corner button`, named `Every property`) on the right, bottom border. Issue: bug, calendar, v4.2 / 3 of 5 sub-issues, Bug triage · Confirmed. Pull request: branch, +84 −12 / Closes #1187, calendar, v4.2.
- [ ] `Phone / Properties · issue` (`Mg3Qu`): Labels row and More row removed; now Assignees, Status, chips. `Phone / Properties · pull request` (`ZgPo0`): More row removed; now Reviewers, Checks, Status, chips. Every pane and screen using them changes, MB33…MB82 included.
- [ ] Tapping the chevron: the rows and chips are replaced in place by `Phone / Properties · issue, every property` (`k9uHBB`, unchanged), whose Fewer row folds back (MB125).
- [ ] `e1palS` (MB95): its properties re-overridden — one chip, payments, the rest hidden.
- [ ] MB128 picked: renamed `MB128 · Rows, then chips`, no amber, pane now a plain `Phone / Item / Issue · summary`, moved to Screens row 3 first. MB124 deleted (its More row is gone). Captions of MB125 and MB126 rewritten.
- [ ] Frame `wKAWs` deleted with MB127, MB129–MB132. Entries above naming them, `Phone / Property · more` as a row on items, and MB124 no longer apply (`gKSlh` stays only as the base of `Phone / Property · fewer`).
