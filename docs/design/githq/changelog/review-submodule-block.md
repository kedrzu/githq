# Review submodule block

A submodule has no diff, so the review's diff shows a block in its place: what changed between the submodule's two
pointers (`packages/app/review/submodules/ReviewSubmoduleBlock.vue`). The pull request in the submodule's repository
that carries the new commit is what tells a reviewer what the bump is about, yet today it is one plain line lost among
the commits, and a large bump lists up to 250 commits and 300 files. The redesign puts the pull request first and
strongest, caps each list at 20 with the rest behind one control, and lays the lists side by side when the block is
wide. Base: `006bf81a`.

## Round 1 · agent brief

Asked: three variants of the redesigned block (wide large bump, narrow, small bump with no pull request), and the file
list with submodules last. Changed: a new `Submodules` group in `App · Code review` with an amber
`Variants · Submodule block` frame (CR127–CR135) and CR136; a new `Submodule parts` group in the code review's
components. The frames below `App · Code review` moved down by 8961 px.

Variant A (recommended) puts the pull request in a raised card; B makes it the block's tinted header bar with a
state-coloured edge; C is dense: one pull request line, a strip of numbers and table-like lists. The cap notes
("212 more commits on GitHub", "More files may have changed") are in every list component but hidden in the screens:
the drawn bump (38 commits, 48 files) is under GitHub's caps.

Shared components, in `Components · Code review` (`crvke`) → `Submodule parts` (`QyRE7`):

- [ ] Diff / File header · submodule (`iKVFx`): new, an instance of `Diff / File header` with the path `nzyme`, the
      tag `Submodule`, no line counts.
- [ ] Submodule / PR state (`yr6PW`) and its `· draft` (`of2rQ`), `· merged` (`yXxFM`), `· closed` (`ZGFwo`): new,
      the state icon and word in its tone (green, `$fg-dim`, purple, red).
- [ ] Submodule / Show more (`zbHGJ`): new, a quiet chevron and "Show 18 more commits".
- [ ] Submodule / Cap note (`t1uGB`): new, GitHub's cap as today, in `$fg-dim`.
- [ ] Submodule / Commit row (`ad2zp`), Submodule / File row (`lDSIq`): new rows for A and B (short id in mono,
      subject, author; change letter coloured as `ReviewChange`, mono path, `PR size / small`).
- [ ] Submodule / Commit rows (`oVyqD`), Submodule / File rows (`Ww057`): new, the 20 rows of the drawn bump.

Variant A, `Variant A · PR card` (`A8DBA`):

- [ ] Submodule A / PR card (`jW49B`): new, `$bg-2` card with a `$border-2` edge, an eyebrow, a 16 px title, the
      state in a pill tinted by its tone, `owner/name#number`, Open →.
- [ ] Submodule A / PR card · none (`cVDhC`): new, the card with no surface, "No pull request carries 7d20e5a".
- [ ] Submodule A / Identity (`hpMBi`): new, path, pointers, relation, Open comparison on GitHub at the end.
- [ ] Submodule A / Commits (`xlRPp`), Submodule A / Files (`zGJAV`): new, a small head with the count, the rows,
      Show more, the cap note (hidden).
- [ ] Submodule A / Block · wide (`ZBbVO`), Submodule A / Block · narrow (`pJoWz`): new, the lists side by side or
      stacked.

Variant B, `Variant B · PR as the header` (`s6Dm64`):

- [ ] Submodule B / PR header (`t8OOh`): new, a bar tinted by the state with a 3 px state-coloured left edge, a
      17 px title, state, `owner/name#number`, "carries the new commit", a chevron.
- [ ] Submodule B / PR header · none (`igdgu`): new, untinted, a grey edge, one quiet line.
- [ ] Submodule B / Subtitle (`JSOqZ`): new, the path, pointers and relation demoted, the comparison at the end.
- [ ] Submodule B / Commits panel (`yyn4j`), Submodule B / Files panel (`X2gdqH`): new, bordered panels with a
      `$bg-2` head carrying the count, Show more in the foot.
- [ ] Submodule B / Block · wide (`SF2tW`), Submodule B / Block · narrow (`ltN5M`): new.

Variant C, `Variant C · Summary strip` (`dOabE`):

- [ ] Submodule C / Commit row (`TnghA`), Submodule C / File row (`Z8dNql`): new, 22 px rows with fixed columns
      (id 56 px, author 112 px right-aligned; size 84 px right-aligned).
- [ ] Submodule C / Commit rows (`sHEdO`), Submodule C / File rows (`NX4W6`): new, the 20 rows of the drawn bump.
- [ ] Submodule C / PR line (`aQuJi`), Submodule C / PR line · none (`Koctm`): new, one line: state, 15 px title,
      `owner/name#number`, Open →.
- [ ] Submodule C / Stat (`ogbYn`), `· lines` (`l5WAnK`), `· submodule` (`d0bRNY`): new strip cells.
- [ ] Submodule C / Stats (`Y0uzRk`), Submodule C / Stats · narrow (`S5Z4PC`): new, the strip on `$bg-2`; the narrow
      one without the comparison, which moves to the block's foot.
- [ ] Submodule C / Commits table (`dE1MU`), Submodule C / Files table (`n39yD`): new, column heads, rows, Show more.
- [ ] Submodule C / Block · wide (`zrMZX`), Submodule C / Block · narrow (`JwBXg`): new.

Screens, in `App · Code review` (`CEDLB`):

- [ ] Group header (`fXXNW`): new, `Submodules`.
- [ ] Variants · Submodule block (`J8dWW`): new amber frame, a row per variant.
- [ ] `CR127 · Variant A · The pull request as a card — wide` (`h8v8z`), `CR128 · … — narrow` (`fNMWk`),
      `CR129 · Variant A · A small bump, no pull request — wide` (`lP42v`).
- [ ] `CR130 · Variant B · The pull request is the block's header — wide` (`x3Aph`), `CR131 · … — narrow`
      (`cY8hq`), `CR132 · Variant B · A small bump, no pull request — wide` (`lK7tg`).
- [ ] `CR133 · Variant C · One pull request line and a strip of numbers — wide` (`biFVF`), `CR134 · … — narrow`
      (`F7b3h`), `CR135 · Variant C · A small bump, no pull request — wide` (`MSyfD`).
- [ ] `CR136 · Submodules last in the file list` (`mlSdU`): new, folders first, then the root's files, then a
      `Submodules` folder header (git-folder icon) holding `nzyme` and `tiptap` with `vendor` after it; each shows
      its commit count in place of a size.

Elsewhere:

- [ ] Every top-level frame from `App · Command menu` (`D27jC`) down: moved 8961 px down, keeping 1200 px under
      `App · Code review`.
