# Code review: go to file

A reviewer who knows a file by name jumps to it as an editor's ⌘P does: ⌘P, a few scattered letters of the path, ↵.
It is not a new menu. "Go to file" is a command of the review with the key ⌘P, and its file search is a nested level
of the command menu (⌘K), with the same mechanics, look and chrome as Search repositories (E7–E10): the subject chip,
a crumb with the command's icon and title, the rows and the footer with a quiet hint at its end. Base: `13bb322c`.

## Round 1 · agent brief

Asked (`.context/go-to-file-brief.md`): a new group "Go to file" at the end of App · Code review, CR144–CR148, over
review screens: nothing typed, typed with matches marked, nothing found, files still arriving, and ⌘K's top level
on a review listing Go to file with ⌘P. A file row as a variant of the menu's result row, if needed. Changed: a new
component pair, a hidden note in the menu's footer, five screens and a group header, frames moved down.

Where it departs from the brief, and why:

- The backdrop is CR20 (`d4ITC`), not a Find screen, because its cursor is in sync.md, the 8th file. The check mark
  shows without scrolling, and the Find screens' marks would distract. Every review screen in the file is
  fitloop/webapp#1202, so the rows are that pull request's files, not githq's (`ReviewFileList.vue`). The copies
  count 312 files, where CR20 counts 42.
- CR145 types `snc`, not `rvwfl`. In that pull request it matches names first (`sync.md`, `SyncBadge.tsx`,
  marks `s` + `nc`). It then matches src/sync's files (`index.ts`, `engine.ts`, …) in their folder only, as the brief
  asked.
- The change kind is the letter the file list draws (`ReviewChange`: M A D R), not an icon: the review has no change
  icons. Same colours as the file list's rows: A `$green`, R `$accent`, M `$fg-dim`, D `$red`.
- The footer keeps "Move" before Open, Back and Close, as every other level of the menu does.

Nodes:

- [x] Components · Command menu (`B7AwZ`): new frame "Parts · File results" (`Q8B4wl`) holding:
  - `Command / Result · file` (`mgDWw`), an instance of `Command / Result` (`k3mGr`). Its icon is replaced by a
    `Change` letter (`ZYEtp`: `$mono` 11, 15 px wide and centred so names line up with the other levels' labels).
    Label (`e2wbth`) is the file name. The chevron slot (`nsltD`) is the chosen mark: lucide `check`, `$fg-2`,
    hidden. It follows the name, as E2's option rows draw it. Sub (`MXfcN`) is the folder, in `$fg-dim`. Right
    (`IxzB4`) is "Viewed", hidden.
  - `Command / Result · file, selected` (`K1FT9`), an instance of the above with `$sel` and the 1 px `#7B87F74D`
    stroke of `Command / Result · selected`.
  - A match is drawn as in E5: in an instance, Label or Sub is replaced by a "Text with match" frame of spans, the
    matched letters in `$accent`.
- [x] `Command / Footer` (`Tkzk6`): new hidden `spacer` (`SPtaz`, fill width) and `Footer note` (`yuFaw`: `$font`
  11.5, `$fg-dim`) at its end, for a level's quiet hint as in E7's footer. Hidden, so nothing that uses the footer
  changes.
- [x] App · Code review (`CEDLB`): new group "Go to file": Group header (`AUu5Y`) with the note, rows `RWQOm` and
  `o7eS1`. Each screen is a copy of CR20 with the scrim (`#05060899`) and a command menu (680 px, x 380, y 96, the
  menu's card, shadow 0 24 64). The file list's head says 312 files, 9 of 312 viewed. The status bar is the plain one,
  without CR20's "First visit" message.
  - CR144 (`nQfbU`, screen `P2q80`) Nothing typed. The crumb is "Go to file" with `file-search`, the placeholder
    "Go to file…". 17 files in the list's order: the first selected, sync.md checked, "Viewed" on the viewed ones,
    no folder at the root. The menu is 600 px high with a scrollbar. The footer shows ↵ Open, ← Back, Esc Close and
    "312 files · type to find one" (at most 100 rows).
  - CR145 (`O9OtXd`, screen `tHND5`) Typed `snc`. 7 name matches, then 7 folder-only matches in `src/sync`, sync.md
    first and checked. The footer note says "14 files". The menu fits its rows.
  - CR146 (`l8iYE`, screen `ROA1R`) Typed `zzq`. The state line (E10's: `$fg-2` 13.5, padding 7 10) reads
    "No file matches “zzq”". No Open hint and no footer note.
  - CR147 (`rdFv1`, screen `Gtemv`) Files still arriving. CR144's rows, the footer note "Reading the files… 120 of
    312", the status bar's loader with "Reading the list of files · 120 of 312".
  - CR148 (`KGKTJ`, screen `i89fY`) ⌘K on the review, nothing typed. The input row is plain with the
    `webapp#1202` chip. The section "Sync: queue edits made offline" lists Merge pull request ⇧M, Assign to › A,
    Add or remove labels › L, Copy link ⌘⇧C and Open on GitHub O. The section "Review" lists **Go to file › ⌘P**
    first, then Find in the diff ⌘F, Next file ], Previous file [, Next thread N, Mark as viewed V, Filter by path /,
    Submit review ⇧S, Show unified, Hide the file list ⌘B, Show the conversation ⌥⌘B and Back to the pull request
    Esc. The footer is ⌘K's.
- [x] Layout: `CEDLB` grew 2229 px and `D27jC` 46 px. Every top-level frame from the menus row down moved down
  2229 px, and from the flows row down 2275 px.

Not done: CR29's keys sheet (`GOlGu`) doesn't list ⌘P yet, because the brief said not to change existing screens. It
needs a row "Go to file" under Files or Finding.

## Round 2 · implementation

Built as the menu's option row (`CommandOption`: `lead`, `detail`, `chosen`, `aside`, `match`) and its footer hint,
with these differences from the drawing, for the design to follow:

- [ ] `Command / Result · file` (`mgDWw`): the current file's check sits after the folder, where the menu's option row
  draws a chosen mark, not right after the name.
- [ ] CR144–CR147 footer note: with nothing typed it says "N files", and adds "· type to find one" only past 100 files
  (CR144's "312 files · type to find one" is that case); typed, it says how many were found, "N files" (CR145's "14
  files").
- [ ] CR29 (`GOlGu`): the key sheet lists "Go to file ⌘P" under Finding, right after "Find in the diff ⌘F"; the drawing
  still lacks the row.
