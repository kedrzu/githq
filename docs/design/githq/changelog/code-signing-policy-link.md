# Code signing policy link

SignPath Foundation, which signs the Windows build for free, requires a link titled "Code signing policy" on the
project's home page and download page. The built footer (`packages/app/landing/LandingFooter.vue`) has one; this brings
the landing footer in `githq.pen` in line. Base: `bfe98f19`.

## Round 1 · implementation

Forced by: the link added to `LandingFooter.vue` (f239cabe). Asked: a fourth link, **Code signing policy**, after
**Privacy** in the footer's Resources column, styled like the others, wherever the footer is drawn.

The footer is drawn by hand twice, not as a component. The download page screens (`LP17`–`LP19`) draw no footer, so
there was nothing to change there; the built download page does show the footer.

On the mobile frame the column fits on one line, but `Columns` (`AerGW`) spaces its three columns with
`space_between`, so the space between them shrank from 18 px to 7.5 px ("Design docs" → "Code signing policy").
Left as it is, per the brief.

- [x] Landing — githq.dev (`JJOFX`), Footer › Resources (`UXTV0`): new text `Code signing policy` (`sVGj0`), a copy of
  `Privacy` (`Zozbg`).
- [x] Landing — githq.dev (mobile) (`ucqck`), Footer › Resources (`ePSHv`): new text `Code signing policy` (`TsjoT`), a
  copy of `Privacy` (`u3zGj`).
