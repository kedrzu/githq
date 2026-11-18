# Two-line item rows in the command menu

The command menu's found issues and pull requests become two-line rows close to the list rows: the kind-and-state icon,
the title and basic facts — reference, checks, standing, the project field — so a found item can be told apart without
opening it. Base: `194512bc`.

## Round 1 · agent brief

Asked: three variants of the two-line item row in the command menu, for the owner to pick
(`.context/command-menu-item-rows-brief.md`, not committed).
Changed: three variant screens in an amber `Variants` frame, each from its own row component; a shared project-field
part. The rows below `App · Command menu` moved down 1136 px to keep 1200 px between rows (position only).

- [ ] Components · Command menu (`B7AwZ`): new group `Parts · Item results` with `Command / Item result · A`
      (`F0DiHJ`) and `Command / Project field` (`mB3rK`). (`· B` and `· C` were deleted in round 2.)
- [ ] App · Command menu (`D27jC`): `E11 · Variant A · Like the list row` (`brt0M`, recommended), a copy of E3 with
      `cal` typed. (The `Variants` frame and E12, E13 were deleted in round 2.)
- [ ] Every top-level frame in the rows below the menus' row: y + 1136 (no other change).

## Round 2 · agent brief

Asked: the owner picked A. Settle the variants, make the open PR's standing one combined fact as the list row says it,
and draw the phone version (`.context/command-menu-item-rows-brief-2.md`, not committed).
Changed: E11 moved into its own row with a group header; a phone screen and a phone item-result component. The rows
below `App · Command menu` moved down another 156 px (position only).

- [ ] Command / Item result (`F0DiHJ`): renamed from `Command / Item result · A`; `· B` (`SvcCH`) and `· C`
      (`mFJzG`) deleted.
- [ ] App · Command menu (`D27jC`): `Variants · Two-line item rows in the command menu` (`N9uHlJ`) with E12 (`yc9Eg`)
      and E13 (`n6CtD`) and their slots deleted, no amber left.
- [ ] App · Command menu (`D27jC`): new group header `Found items, two lines` (`a0ooIB`) and row
      `Row of screens · Found items` (`d0BXnD`) under the repository search row, holding E11's slot (`wspS5`).
- [ ] E11 (`brt0M`): renamed `E11 · Variant A · Like the list row` → `E11 · Found items · two lines` (slot and
      caption too); caption rewritten.
- [ ] E11 · `Item portal#1187` (`NDuBs`): two statuses "Checks passed" + "Approved" → one green check
      "Approved · checks passed" (the second status hidden). The draft keeps "1 check failing" then "Draft".
- [ ] Components · Mobile › Menus (`GnvbT`): new `Command / Item result · phone` (`OyV9N`), at the phone command
      menu's sizes (390 wide, 16 px sides, 15 px title): line 1 the type icon and the title on one line, cut short;
      line 2 the reference, checks (`✓ 12/12`, red `✕ 8/9`), standing (`Approved`, `Merged`) or `Draft`, the project
      field (`Command / Project field`), then the avatar and the age at its end, as the phone list row.
- [ ] App · Mobile › Row of screens (`VLuIQ`): new `Slot · MB272 · Command menu · Found items, two lines` (`KUXwe`)
      after MB39, a copy of MB39 over `Platform Q4`'s list with `cal` typed and the keyboard down: one action, two
      places, then E11's five items upwards, the best match (`portal#1187`, highlighted) right above the input.
- [ ] Every top-level frame in the rows below the menus' row: y + 156 (no other change).
