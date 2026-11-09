Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/groovy-moth/githq.pen

The stack bar's chevron moves next to the stack's name and the whole bar toggles the rows (stacked-prs D27).

- [ ] Stack bar (`cVyyK`): the unfold chevron (`CpMgq`) moves from the right end to right after the stack's name. It is no longer a
  button: a 16×16 slot with no corner radius and no hover fill, holding `chevron-down` 14 px in `$fg-3` (was a 24×24 button, radius 4,
  icon `$fg-2`). The divider before it (`o6DB90`) is gone and the right padding 8 → 16, so the squares end 16 from the edge. It's a
  component, so every stack bar changes.
- [ ] Stack bar, behaviour: a click anywhere on the bar outside the squares drops the rows over the content, and closes them again
  (Esc, a click outside and opening a pull request still close them too). A square still opens its pull request.
- [ ] Stack bar instances with the rows in view (`FK00I`, `JJlr8`, `hsWwt`, `tO9ml`, `jDP9E`, `cBwBS`, `mCsvT`, `By3sE`): the chevron
  is not rendered at all (`enabled: false`; was `opacity: 0`, keeping its place).
- [ ] SP84 · rows dropped over the content (`ZIQlL`): the open bar shows `chevron-up` in `$fg-3`; the chevron's `$bg-3` pressed fill is gone.
- [ ] Captions of SP82–SP84 (`Fld6E`, `uR70y`, `XpcwJ`) say the chevron sits after the name and the whole bar toggles the rows.
