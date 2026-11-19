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
