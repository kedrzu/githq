# Default commit email per owner and per repository

Merging commits under an email; today the merge panel starts on GitHub's account-wide default and `Y` switches it for
one merge only. A default commit email per owner (user or organisation) and per repository (overriding the owner's)
lets the panel start on the resolved address: repository's → owner's → GitHub's default, skipping an address GitHub
doesn't offer for the repository. Applies to direct merges and turning auto-merge on, not to rebase, merge queues,
stacks or bypass. Base: `42256c98`.

## Round 1 · agent brief

Asked (`.context/commit-email-brief.md`): variants for where the defaults are set (Settings) and for how the merge
panel's email line shows and sets them. Changed: two amber `Variants · …` frames with five Settings screens and six
merge panel screens; new components for the select, the commit email rows, the address menus and the email line.

- [ ] Components · Settings (`q9BSr`): new group `Commit email` (`QpflW`); width 6331 → 6999 to fit it.
- [ ] Settings / Select (`uy4u8`), Settings / Select · open (`w0Ggo`): new, a value with a chevron in a bordered box.
- [ ] Settings / Commit email row (`q6Tox`): new, label, select, note, and a hidden `not offered here` mark.
- [ ] Settings / Address menu (`Cswxk`): new, an owner's addresses, GitHub's default first.
- [ ] Settings / Owner group (`r7z5p0`): new hidden child `Commit email` (`YV6vz`, "· commits as <address>"); no
      existing screen changes.
- [ ] Settings / Owner group · commit email (`h6oJxw`), … · commit email, open (`xhGvA`): new variants showing it.
- [ ] Settings / Commit email owner (`k1pP2j`), … override (`z7pUU`), … override · selected (`W5BN8`), … add override
      (`dKMNz`): new, Variant C's list rows.
- [ ] App · Settings (`i3VkT`): new row after T16's row with `Variants · Where the default commit email is set`
      (`b9LGVH`): T24 Variant A · Commit email on the repository's page (recommended), T25 Variant A · The owner's
      address isn't offered here, T26 Variant B · The owner's default on its group in Repositories, T27 Variant B ·
      Only this repository's choice on its page, T28 Variant C · Commit email, its own section in Settings.
- [ ] Components · Merging (`XtYJa`): new group `Commit email` (`w2LCR`).
- [ ] Merge / Email line (`WUUTY`): new, from PM6's email line, plus hidden source note, `Change default…` link,
      `⇧Y Make default for this repository` hint and `Saved as this repository's default` note.
- [ ] Merge / Email line · source (`Em1Fj`), · changed, make default (`s845b`), · saved as default (`Xj73N`), · menu
      open (`u3EYK`), · change default link (`jdijk`): new variants.
- [ ] Merge / Email menu (`JMQjt`): new, Variant B's menu with the `Remember for this repository` switch (`⇧Y`).
- [ ] PM6 (`jO8c9`): its hand-drawn email line `T4C8vy` → instance `LrQrj` of Merge / Email line, same rendering.
- [ ] App · Merging a pull request (`LLr2k`): new row after PM6's row with `Variants · Commit email in the merge
      panel` (`ChXT1`): PM44 Variant A · Opens on the default, says whose (recommended), PM45 Variant A · Another
      address after Y, ⇧Y keeps it, PM46 Variant A · Right after ⇧Y, PM47 Variant A · Turning auto-merge on, PM48
      Variant B · Y opens a menu of addresses, PM49 Variant C · The source, and a way to settings.
- [ ] Canvas: every top-level frame from y 89356 down (the platforms row, web and brand) moved 1157 px down to keep
      1200 px under the taller App · Settings.

## Round 2 · agent brief

Asked (`.context/commit-email-brief-2.md`): the owner picked Variant A for Settings and Variant B for the merge panel.
Keep the chosen screens, delete the rest and the components only they used, and draw Variant B's missing states.
Changed: T24 and T25 are ordinary screens; PM48 stays, with four new screens PM50–PM53 beside it; the menu's
`Remember for this repository` got an on variant.

- [ ] App · Settings (`i3VkT`): T24 and T25 moved out of `Variants · Where the default commit email is set`
      (`b9LGVH`) into their row (`NGEPp`); the Variants frame deleted with T26, T27 and T28. Height 12714 → 12576,
      width 7728 → 7680.
- [ ] T24 (`zV1G9`, screen `wtbIK`): renamed `T24 · Variant A · Commit email on the repository's page (recommended)` →
      `T24 · Commit email on the repository's page` (slot, screen, caption); the caption note loses `Recommended.`.
- [ ] T25 (`XdgWB`, screen `R95pB6`): renamed `T25 · Variant A · The owner's address isn't offered here` →
      `T25 · The owner's address isn't offered here` (slot, screen, caption).
- [ ] Settings / Owner group (`r7z5p0`): hidden child `Commit email` (`YV6vz`) deleted; no screen showed it.
- [ ] Deleted, used only by Variants B and C: Settings / Owner group · commit email (`h6oJxw`), … · commit email,
      open (`xhGvA`), Settings / Commit email owner (`k1pP2j`), … override (`z7pUU`), … override · selected (`W5BN8`),
      … add override (`dKMNz`), Settings / Address menu (`Cswxk`, only T26 used it; T24 and T25 don't open a select).
- [ ] App · Merging a pull request (`LLr2k`): `Variants · Commit email in the merge panel` (`ChXT1`) deleted with
      PM44, PM45, PM46, PM47 and PM49; its row (`sYRYr`) now holds, left to right, PM50, PM48, PM51, PM52, PM53.
- [ ] PM48 (`tXcIj`, screen `k1hAM1`): renamed `PM48 · Variant B · Y opens a menu of addresses` →
      `PM48 · Y opens a menu of addresses` (slot, screen, caption).
- [ ] New PM50 · At rest, on the default, says whose (`kl8HK`): the panel ready to merge, the email line closed
      (`Merge / Email line · source`): address, `2 more`, `default for acme-corp`, `Change Y`; no ⇧Y.
- [ ] New PM51 · The menu, Remember for this repository on (`jgJQP`): PM48 with `Merge / Email menu · remember on`,
      the cursor on michal@kedrzu.dev, the tick still on michal@acme-corp.com (the address in use).
- [ ] New PM52 · Right after picking, remembered (`W0tKD`): the line on michal@kedrzu.dev with `default for this
      repository` and, once, `Saved as this repository's default` (`Merge / Email line · saved as default`).
- [ ] New PM53 · Turning auto-merge on (`qIgMV`): from PM47, `Enable auto-merge` the primary, the email line as in
      PM50.
- [ ] Merge / Email menu · remember on (`vRu50`): new, an instance of Merge / Email menu (`JMQjt`) with the switch
      as `Switch / on` (`sh74L`).
- [ ] Deleted: Merge / Email line · changed, make default (`s845b`), … · change default link (`jdijk`).
      Merge / Email line · saved as default (`Xj73N`) stays, used by PM52.
- [ ] Merge / Email line (`WUUTY`): hidden children `Make default` (`CQ58V`, the ⇧Y hint) and `Link` (`TZGVp`,
      `Change default…`) deleted; `Source` and `Saved` stay. PM6 (`jO8c9`) renders as before.
- [ ] Components · Merging, group `Commit email` (`w2LCR`): holds the line, its source, saved and menu-open
      variants, and both menus.
- [ ] Canvas: the platforms row and the web and brand row (13 frames from y 90513 down) moved 138 px up, keeping
      1200 px under the shorter App · Settings.
