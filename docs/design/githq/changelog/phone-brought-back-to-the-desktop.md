Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

The phone design corrected after the review against the desktop
(`docs/design/mobile/history/2026-11-08-review-against-the-desktop.md`), applying mobile D9, D27, D36, D42–D48, and the
desktop's new issue toast (mobile D44). Phone work is inside `App · Mobile` (`jy6bO`); new components are in Components
· Mobile → `Brought back to the desktop` (`DJ9xJ`); new screens MB218–MB221 are in the new section `Brought back to the
desktop on a phone` (`mZPlf`). The desktop change is in `App · Creating an issue` (`gvCqI`) and `App · Toasts`.

## The menu at the bottom (D45)

- [ ] New `Phone / Menu` (`gf3JG`): what is a dropdown on the computer, pinned to the bottom of a phone's screen. Distinct
  from the command menu's sheets: no ⌘, no context chip, no Back. Head with `Title` (`I5kQbM`, the property) and
  `Subject` (`e0cU1`, what it is on, mono) and × (`shPwX`); `Search` (`OHhrI`) with a rounded `Field` (`CYpt8`), `Query`
  (`qig8z`, the desktop picker's placeholder) and `Caret` (`HFjpk`, off); `Entries` (`k0N2w`) made of `Phone / Command
  result` rows; `Keyboard` (`zIojp`, off) and `Home indicator` (`FKWPh`). With the keyboard up, Keyboard on and Home
  indicator off.
- [ ] Its variants, each an instance with its own entries: `Phone / Menu / Status` (`z7aSQ8`), `/ Assignees` (`Xw0L2`,
  "Assign to…"), `/ Labels` (`S3SI3`, "Filter labels…"), `/ Reviewers` (`FD7Pv`), `/ Close` (`eJdp0`, no search),
  `/ Repository` (`ToAiG`, D43: tracked, then On GitHub; "Type part of a repository's name"), `/ Repository · in a
  project` (`H0p65w`: Draft issue, the ones used last in the project, tracked), `/ Template` (`SKoTS`), `/ Filter`
  (`ACyjg`, for later, D46), `/ Stack` (`LGold`, D48).
- [ ] Screens that opened the command menu at a property's step now open its menu: MB74 (`s7O74`, Assignees typed "dk",
  keyboard up), MB108 (`qUE2g`, Labels), MB109 (`H4YWj`, Close), MB110 (`Y4yg7`, Reviewers), MB196 (`DlQXA`, Labels of
  the new issue), MB193 (`t1fnP0`, Repository typed "sdk"), MB200 (`vdF9d`, Template), MB176 (`PMhvC`, Filter).
- [ ] `Phone / Command sheet / Status · from below` (`iceKP`): its input is now `Phone / Picker input` ("Find a status…"),
  so the step reached through ⌘ (MB40) no longer shows ⌘ and the item's chip in its search, as MB74 did.
- [ ] Deleted, now unused: `Phone / Command sheet / Assignees · picking` (`KMrAa`), `/ Labels · picking` (`xBrsD`),
  `/ Reviewers · picking` (`kdXH0`), `/ Close · from below` (`lBgtP`), `/ Repository · picking` (`aCoEC`),
  `/ Template · picking` (`F85iW`), `/ Filter · fields` (`DMySX`).

## One toast (D44)

- [ ] `Phone / Toast` (`KchF8`) is now the phone's only toast, built like the desktop `Toast`: vertical, `$bg-2`; `Head`
  (`keJ26`) with the icon (`j09A0`, default green check), `Title` (`dAcfW`, 14 px 600), `Detail` (`AEy6Y`, 13 px `$fg-2`)
  and `Close` with the countdown `Remaining` (`L95w7O`); `Actions` (`u2dbuS`) with `Primary` (`qjrUu`, `Phone / Toast
  button · primary`) and `Secondary` (`nrvJx`). The bold one-word action (`T8mz7c`) is deleted: every action is a real
  button. A failure turns off Remaining (it stays until dismissed) and Primary.
- [ ] `Phone / Toast · with actions` (`ajtfg`) deleted; its three uses are `Phone / Toast` instances.
- [ ] `Phone / Toast button` (`gYX8L`): height 36 → 32, padding 14 → 12, label 14 → 13.5. Both toast buttons follow.
- [ ] Every phone toast repointed: MB52 (`TGCMX`, Retry), MB94 (`uKOea`, Retry), MB119 (`W5yyn`, Select the failed
  item), MB153 (`k12RQw`, Undo, with the countdown), MB215 (`kaFuE`), MB204 (`YPhqe`), MB217 (`UrADd`) (Create another and
  Open). MB52's toast holder (`HS81s`) y 680 → 608, so the taller toast stays above the command line.
- [ ] Desktop: new `Toast / Issue created` (`SnRpU`) in Components · Toasts, an instance of `Toast` (`E6hAh`) whose
  actions are `Button / icon, label, no key` "Create another" (plus) and `Button / label, no key` "Open"; no Dismiss
  button, the countdown's × closes it.
- [ ] Desktop: new row `Row of screens · Created` (`mLkpf`) in App · Creating an issue with `H10 · Created, with Create
  another and Open` (`aHemN`): My work after creating, the toast bottom right.
- [ ] Desktop: the form's "Create another" hint is turned off in H3 (`YBIYk`), H4 (`IpziQ`) and H9 (`Jti4G`); H1's
  caption (`VlguI`) says Enter creates and a toast offers Create another and Open (H10), instead of ⌘Enter keeping the form.

## My work (D47)

- [ ] `Phone / List / My work · All` (`B9fFBr`) rebuilt with the current rows (D23) and the filter strip: `Phone / Filter
  strip · All`, Review requested 2 (api#311, mdlint#88), My pull requests 3 (webapp#1201, tasklet#418, vite#19021),
  Assigned to me 5 (webapp#1187 with #1205 nested, webapp#1204, tasklet#97). Every screen built on it changes: MB26,
  MB66, MB80, MB145, MB171, MB175, MB193 (and MB68, now built from MB193).
- [ ] MB140's pane (`pS4Ti`) rebuilt the same way, with Assigned to me and Mentioned arriving. The strip is drawn as it
  is elsewhere; what its counts say while groups arrive is part of the strip still being settled with the owner.
- [ ] MB65 redrawn (`I0dJA`): every group at once, Review requested at 0 with `Empty / Nothing there · group` ("Nothing is
  waiting on your review."); strip Needs me 6, All 11; chip My work 11.
- [ ] The command line's chip on My work reads "My work" instead of "All" or a group (MB26, MB65, MB66, MB80, MB89,
  MB90, MB93, MB96, MB100, MB114, MB139, MB140, MB141, MB145, MB171, MB175).

## The desktop's capabilities (D48), new screens MB218–MB221

- [ ] `Phone / Sheet / View options` (`BcxyQ`): new `Row field` (`VQ2Zu`, off by default): a section, chips (Status
  selected, Iteration, Priority, None) and the desktop's detail line. On in MB218.
- [ ] New `Phone / Places account · sending` (`s5Do5c`): arrow-up-circle in `$accent`, "Sending 2 changes ·
  webapp#1187", no allowance.
- [ ] MB218 · A project's row field (`QS2CI`); MB219 · The edits still being sent (`BbzGS`, the places panel with the
  sending account); MB220 · A stack, unfolded (`xNuOQ`, `Phone / Menu / Stack` over MB122: "#1205 stops 2 later from
  landing", then #1203–#1207 with their states); MB221 · Only the failed item selected (`X1SYt`, after MB119's Select the
  failed item: #1204 alone ticked, "1 selected", no toast).

## Other screens

- [ ] MB34 (`ABM7h`): the hand-drawn dropdown is gone; the repository's pull requests (`BkUsw`, chip Pull requests 18)
  with the options sheet for pull requests (no issue type).
- [ ] MB67 (`VWJdJ`): the title is empty ("Title" in `$fg-3`), the repository filled in. MB68 (`m042g6`) redrawn: My work
  with `Phone / Menu / Repository` and the keyboard. MB194 keeps the typed title. The three are no longer identical.
- [ ] MB211 (`klz5t`): the suggested "+ Platform Q4" chip moved to the second line of chips; nothing past the edge.
- [ ] MB137 and MB157: the hand-drawn sheets are components, `Phone / Sheet / Private data hidden` (`MPx50`, shorter
  first paragraph, 4 px under its button) and `Phone / Sheet / Sign out` (`xH9iP`).
- [ ] MB98 is about webapp#1201 (Bump payment SDK to v12, 1 failing · 8 passed, dkim approved), no longer #1205, which
  passes 9/9 everywhere else. #1201's rows read 8/9 everywhere (`jkMrN`, `GH4o2`, `NBEay`, `Xt10c`, `S7QBg`).
- [ ] Numbers made to agree: "Waitlist promotion skips members with an expired pass" is #1204 everywhere (My work had
  #1190, which is a pull request in the repository); the issue created in MB204 is #1211 (#1209 is a draft pull request
  in MB99); "Studio admins can't export last month's bookings" is #1213 (#1199 is "iCal feed per instructor"); MB61's
  last three rows (`CDJ76`, `Iewjo`, `OStQy`) are older issues #1141, #1137, #1130 instead of repeats with #1087/#1099.
- [ ] MB217: its rows carry the project list's data (status icon, labels, assignee) as in `Phone / List / Project ·
  Current sprint`.
- [ ] Titles without "Variant": MB173, MB174, MB175, MB193 (now "Choosing the repository · Typing"), MB194, MB195,
  MB196 ("A chip opens its menu"), MB200, MB204 ("Another, from the toast"). Renamed: MB52 "An edit that failed", MB53
  "In the places panel", MB176 "Later, not in the first version · Adding a filter".
- [ ] Questions for the owner, amber: MB97 (`N6uRDK`, the fold and "N new since you looked" are not on the desktop) and
  MB173 (`s3IZJ`, the Empty groups switch is not on the desktop).
- [ ] Captions rewritten to the decisions: MB40, MB52, MB63 and MB205 (D9: plain group headers, a board saved on GitHub
  shows as a grouped list), MB65, MB66 (tracking is in Settings on a phone too), MB67, MB68, MB74, MB80, MB89, MB92,
  MB108–MB110, MB112, MB114, MB119, MB128, MB173–MB176 (the filter row is for later, D46), MB193, MB194, MB196, MB200,
  MB204, MB210, MB211, MB216; the section description of Lists and new issue (`i5IIw8`).
