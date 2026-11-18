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
      (`F0DiHJ`), `· B` (`SvcCH`), `· C` (`mFJzG`) and `Command / Project field` (`mB3rK`).
- [ ] App · Command menu (`D27jC`): new frame `Variants · Two-line item rows in the command menu` (`N9uHlJ`) with
      `E11 · Variant A · Like the list row` (`brt0M`, recommended), `E12 · Variant B · One standing, quiet` (`yc9Eg`),
      `E13 · Variant C · State words first` (`n6CtD`), each a copy of E3 with `cal` typed.
- [ ] Every top-level frame in the rows below the menus' row: y + 1136 (no other change).
