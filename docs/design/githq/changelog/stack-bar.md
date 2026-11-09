Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

The stack bar's chevron moves next to the stack's name and the whole bar toggles the rows (stacked-prs D27).

- [x] Stack bar (`cVyyK`): the unfold chevron (`CpMgq`) moves from the right end to right after the stack's name. It is no longer a
  button: a 16×16 slot with no corner radius and no hover fill, holding `chevron-down` 14 px in `$fg-3` (was a 24×24 button, radius 4,
  icon `$fg-2`). The divider before it (`o6DB90`) is gone and the right padding 8 → 16, so the squares end 16 from the edge. It's a
  component, so every stack bar changes.
- [x] Stack bar, behaviour: a click anywhere on the bar outside the squares drops the rows over the content, and closes them again
  (Esc, a click outside and opening a pull request still close them too). A square still opens its pull request.
- [x] Stack bar instances with the rows in view (`FK00I`, `JJlr8`, `hsWwt`, `tO9ml`, `jDP9E`, `cBwBS`, `mCsvT`, `By3sE`): the chevron
  is not rendered at all (`enabled: false`; was `opacity: 0`, keeping its place).
- [x] SP84 · rows dropped over the content (`ZIQlL`): the open bar shows `chevron-up` in `$fg-3`; the chevron's `$bg-3` pressed fill is gone.
- [x] Captions of SP82–SP84 (`Fld6E`, `uR70y`, `XpcwJ`) say the chevron sits after the name and the whole bar toggles the rows.

The screens brought in line with what PR #235 built (stacked-prs D25, D27, amended 2026-11-09). All of it is already built.

- [x] Stack bar (`cVyyK`), Places (`YyQc4`): gap between the squares 3 → 6, as in `Review / Stack strip`. It's a component, so every stack
  bar changes.
- [x] The map's last line ("Map foot"): the merge button is gone from SP3, SP5, SP6, SP34, SP36, SP82 (`xSxA6`), SP84 (`LAnoB`), and
  "Rebase on GitHub" from SP8. The map offers no merge; `⇧M` does.
- [x] SP83 · Tooltip · #67 (`jvwuE`): one line, "7: #67 Pause on rate limit" (was the number and title, then "7 of 10 · Waiting for
  review"); the number text (`vFRaJ`) hidden, the state line deleted.
- [x] Captions: SP82 (`Fld6E`) drops "the merge" and says ⇧M merges; SP83 (`uR70y`) names the browser's tooltip; SP84 (`XpcwJ`) adds
  the 150 ms slide from under the bar (D38) and that any scroll of the content puts the rows away; SP30 (`bGhyJ`) says the map offers no
  merge in a stack of any size.
