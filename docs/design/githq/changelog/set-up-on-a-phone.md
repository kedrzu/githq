Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

Brief: `docs/design/mobile/ui/set-up-on-a-phone.md`. Everything here is new, except `Phone / Places account` (D32, below). The owner's picks are
at the end; the entries above naming deleted variants no longer apply.

- [ ] App · Mobile (`jy6bO`): new section `Setting up on a phone` (`RwOFW`) after `Acting on My work`, codes MB133–MB170,
      with `Screens · Setting up` (`nS6Oi`) and five `Variants · …` frames.
- [ ] Components · Mobile (`F3mZHt`): new group `Setting up` (`WvTy4`), built from the existing atoms:
      checkbox `Phone / Checkbox` (`R3eFCP`), `· on` (`aZCZf`), `· tracked` (`mNHLm`, grey fixed tick);
      `Phone / Switch` (`DlFSX`, 46 × 28), `· on` (`FzXCI`); `Phone / Radio` (`tKpkL`), `· on` (`Cpmzj`);
      `Phone / Button` (`MUwAt`, 48 px, `$accent`, label `#0D1117`, optional icon and ↗), `· secondary` (`vhtzY`), `· danger` (`rItKn`, red label);
      `Phone / Track / Repository row` (`Oc0gA`), `· ticked` (`z4IRf`), `· tracked` (`kqCmA`); `Phone / Track / Project row` (`xQ9xP`), `· ticked` (`b3AiO`), `· tracked` (`gGi0S`);
      `Phone / Track / Group head` (`tYBDs`); `Phone / Track / Search` (`w1umsV`), `· typing` (`FxAf2`);
      `Phone / Track / Hidden private repositories` (`jA07A`, amber note in the list); `Phone / Track / Save option` (`Qv1Wq`);
      `Phone / Track / Footer` (`pD4fK`, count, Only mine, Track these); `Phone / Track / Keyboard bar` (`jcsrl`, Variant A of MB163 only);
      `Phone / Setup bar` (`H329p`, wordmark and the signed-in user, for screens outside the app);
      `Phone / Settings / Row` (`saAOr`, icon, label, value, chevron or ↗), `/ Group` (`qv3BF`), `/ Note` (`l7pgf6`),
      `/ Switch row` (`Ytf9x`), `· on` (`UVD7H`), `/ Choice row` (`CtZUc`), `· selected` (`z5RlBA`),
      `/ Tracked row` (`jJlQM`), `· downloading` (`rUo3C`, amber dot and how far);
      panes `Phone / Settings / Sections` (`m35OG`), `/ Repositories` (`dgRSB`), `/ Projects` (`pKu31`);
      `Phone / Still arriving · screen` (`ZwALT`) and `· group` (`ZVM2y`), ghost rows from `Empty / Ghost row`.
- [ ] Screens · First sign-in: MB133 back on the landing page after a cancelled sign-in (`Phone / Banner`, Try again);
      MB134 saved settings found (G11); MB135 choosing what to track (G2 in one column: Repositories and Projects as two
      segments, groups by owner, footer with Track these); MB136 an organisation hiding its private repositories (amber
      note in the group, save option at the end of the list); MB137 the sheet explaining it, with Request approval on
      GitHub ↗; MB138 no repositories at all (Continue to My work).
- [ ] Screens · Landing on My work: MB139 nothing arrived yet (ghost rows, "Fetching your work", no count on the
      command line); MB140 some groups in, others arriving with ghost rows and no count.
- [ ] Screens · Getting to Settings: MB145 the command menu finding Settings and each section by name.
- [ ] Screens · Settings (as Variant A of MB146): MB151 Repositories (grouped by owner, a downloading row says how far,
      + and Track more); MB152 a repository's settings (Tracking with Stop tracking and what it deletes; Workflow alerts);
      MB153 stopped tracking, toast with Undo; MB154 Projects; MB155 a project's settings; MB162 nothing tracked;
      MB156 Account (organisations, acme-health amber with Request approval ↗, this phone's copy, Sign out and clear);
      MB157 signing out asked once in a sheet; MB158 Display (Animations only, no repository layout); MB159 Code review;
      MB160 Saving settings off; MB161 Saving settings on.
- [ ] Amber, waiting for the owner: `Variants · Where the first download's progress shows` (`WkbAS`): MB141 A the foot of
      the places panel, MB142 B a strip under the top bar.
- [ ] Amber: `Variants · How Settings opens from the places panel` (`SHZ0q`): MB143 A the account row opens Settings and
      Sign out moves into Account, MB144 B a Settings row above the account. Both are overrides on instances of
      `Phone / Places panel · in My work`; the panel component is unchanged until a pick.
- [ ] Amber: `Variants · How Settings' sections are reached` (`u6af2`): MB146 A a list of sections first, MB147 B the
      first section open with segments along its top, MB148–MB149 C one long screen, MB150 D the section as the command
      line's part.
- [ ] Amber: `Variants · Choosing what to track with the keyboard up` (`raShh`): MB163 A search on top, Track these on a
      bar above the keyboard, MB164 A adding a repository by its name, MB165–MB166 B search at the bottom, Track in the
      corner, MB167 C picked ones in a line, Track these after Done.
- [ ] Amber: `Variants · Adding a repository later` (`bgknx`): MB168 A the first sign-in's screen again, MB169–MB170 B a
      picker from below.

## The owner's picks (D31–D33)

- [ ] Download progress settled (D31): MB141 renamed `MB141 · The download at the foot of the places panel`, moved to
      Screens · Landing on My work (`KUP1o`), caption rewritten. Its panel's account is the new
      `Phone / Places account · downloading` (`q2g0X`, an instance of `Phone / Places account`): `loader-circle` icon in
      place of the green dot, "1,240 of 8,000 · about 2 min" (the desktop left segment's words, ES5), the allowance
      hidden. MB142 and the frame `WkbAS` deleted. No list shows a download strip.
- [ ] The account menu (D32): `Phone / Places account` (`T9SeJV`): the "Sign out" text (`BQrKu`) replaced by a
      `chevrons-up-down` icon (`axt1C`, 16 px, `$fg-2`). It's a component, so every places panel changes (MB26, MB27,
      MB53, MB66 and the rest). New `Phone / Menu / User` (`dUAqh`): "Signed in as mlaine", Settings, a line, Sign out;
      46 px items, `$bg-3`, 12 radius, shadow. New screen MB171 · The account menu (`Ldn9Z`) in Screens · Getting to
      Settings (`rvXsH`): the menu above the tile, the tile `$sel`. Frame `SHZ0q` deleted with MB143 and MB144.
- [ ] Sections settled (D33): MB146 renamed `MB146 · Settings · The list of sections`, moved to Screens · Getting to
      Settings, caption rewritten. Frame `u6af2` deleted with MB147–MB150.
- [ ] Captions of MB145, MB156, MB157 and the section's description updated; title range now MB133–MB171.
- [ ] Still amber: `Variants · Choosing what to track with the keyboard up` (`raShh`) and
      `Variants · Adding a repository later` (`bgknx`).

## The owner's picks (D34–D35) and the computer's chooser searching GitHub

- [ ] Keyboard settled (D34): MB163 renamed `MB163 · Choose what to track · typing`, MB164 renamed
      `MB164 · Choose what to track · found on GitHub`, both moved to Screens · First sign-in 2 (`tJK5l`), captions
      rewritten. Frame `raShh` deleted with MB165–MB167. Build `Phone / Track / Keyboard bar` (`jcsrl`).
- [ ] MB164 (`Zh8ew`) reworked: typing "nuxt", "None of your 327 repositories match", then `On GitHub · not in your
      lists` with nuxt/nuxt (ticked), nuxt/ui, nuxt/content, nuxt-modules/i18n — GitHub's search, not only an exact
      owner/name. While GitHub answers the group's place reads "Searching GitHub…"; with no results "Nothing on GitHub
      matches".
- [ ] App · First sign-in and choosing what to track (`Zk4sa`): new row `Row of screens · Found on GitHub` (`XBrlh`)
      with G18 · Choose what to track · a repository found on GitHub (`rxISf`) and G19 · Choose what to track · searching
      GitHub (`SiKWs`), copies of G4. The chooser's filter also asks GitHub (as Search repositories…, E8: from two
      characters once typing pauses, qualifiers work); its results follow the user's matches under a second header "On
      GitHub · not in your lists · from GitHub's search" and tick like any row; rows already in the user's lists are not
      repeated. G19 shows "Searching GitHub for “nuxt”…" on one line. Applies to Settings' chooser (T18) too; G10's name
      input becomes this search.
- [ ] Adding later settled (D35): MB168 renamed `MB168 · Settings · Track repositories`, moved into Screens · Settings ·
      tracking (`RFmyG`) after MB153. Frame `bgknx` deleted with MB169–MB170.
- [ ] New MB172 · Settings · Track projects (`D5UPgU`) in the same row: the choosing screen on its Projects segment,
      tracked ones grey and fixed, Bug triage picked, acme-health "can't be listed", footer Track 1 project.
- [ ] Captions of MB135, MB138, MB151 rewritten to point at MB163, MB164, MB168; section title MB133–MB172, description
      says nothing is left to pick.
