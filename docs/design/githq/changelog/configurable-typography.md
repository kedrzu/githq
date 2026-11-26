# Configurable typography

Text reads in three roles, each with a font: Reading (what people wrote) and Code (diffs, code in comments, logs) also
take a size and a line height, Interface keeps its sizes. Presets Compact, Default and Spaced set the sizes at once;
a value changed by hand makes the choice Custom. Settings › Display, desktop layout only. Comment text moves to
Default's 14 px / 1.5, GitHub's size (D49). Base: `23218840`.

## Round 1 · agent brief

Asked: the Typography section in Settings › Display (presets, a card per role with a live sample), the same with
hand-made values and other fonts, the Code font menu open; comment text at 14 px / 1.5. Changed: three screens, new
components in `Components · Settings`, the comment components' text.

- [ ] Components · Settings (`q9BSr`): new frame `Typography` (`a2tIu`); the frame widened 6999 → 7607 px.
- [ ] Settings / Stepper (`k5SSra`): new, `− 14 px +` with `Icon button / sm`.
- [ ] Settings / Preset control (`G1JHSp`): new, an instance of `Tabs / group`, Default selected, Custom dimmed;
  variant `· Custom` (`O92kT`).
- [ ] Settings / Font select (`KxkxV`): new, `Settings / Select` at 200 px; variant `· open` (`z2Llia`).
- [ ] Settings / Typography card (`wUXgp`): new, with `· Reading` (`F2DpGb`), `· Code` (`Cxb1u`, three
  `Diff / Row · unified` as its sample) and `· Interface` (`Rk95R`, font only).
- [ ] Settings / Font option (`REQc7`, from `Workflow / Group option`) and `· selected` (`YixDI`): new.
- [ ] Settings / Font menu · code (`N75Fw`): new, the nine code fonts, each in its own font.
- [ ] App · Settings (`i3VkT`), row `iSUq3`: new `T28 · Settings · Display · Typography` (`iC43i`, screen `sZ5aR`),
  `T29 · Settings · Display · Typography · Custom, other fonts` (`fxSzb`, `N02u7S`), `T30 · Settings · Display ·
  Typography · Font menu open` (`eyIhQ`, `o0RiDi`, menu `s63YQ`). Pen has no Monaspace or Commit Mono: DM Mono,
  Red Hat Mono, Courier Prime and Roboto Mono stand in, as the captions say.
- [ ] Activity / Comment (`WHy4W`) text `BujgM`, Activity / Review (`b1us0`) `ZCoSV`, Activity / Latest comment
  (`cK3wW`) `rYM7u`: 13.5 / 1.6 → 14 / 1.5.
- [ ] Review / Comment (`IHFo8`) `ca6WN`, `o6hbQ`: 13 px / 20 px → 14 / 1.5.
- [ ] Review / Summary (`jHkgH`) `IUKRE`: 12.5 / 1.5 → 14 / 1.5.
- [ ] Item / Body (`bJhAe`): body, bullets and "Closes" 13.5 / 1.6 → 14 / 1.5; heading `VxGG5` 14 / 1.6 → 15 / 1.5.
- [ ] Activity / Editor (`OXAXr`): five texts 13 / 1.55 → 14 / 1.5.
- [ ] App · States (`epLfx`), App · Freshness (`iZkBN`), App · Loading and empty states (`O6Vuj8`), App · Toasts
  (`Sz7Bf`) and the note `BnN7r`: moved 4048 px right, App · Settings having grown to 12240 px.
