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

## Round 2 · agent brief

Asked: the built download page (`DownloadScreen.vue`) ends with `LandingFooter`, so SignPath's "Code signing policy"
link shows there too; the download page screens `LP17`–`LP19` drew no footer. Turn the hand-drawn footers into
components and put one at the bottom of each download page screen.

Changed: the desktop and mobile footers differ in layout (columns spaced by a 96 px gap vs `space_between`, the bottom
row horizontal vs vertical, other padding), so they became two components, copied from the originals with only their
width fixed (`fill_container` → 1440 / 390, the widths of the screens that hold them). Both landing footers are now
plain instances with no overrides, so the landing screens are unchanged (10330 / 12180 px tall, as before). Instances
on the download page override nothing either: their section links point back to the landing page in the code, which
looks the same. The screens are fit-content, so they grew; nothing sits below `Landing · Download page`.

Ticked as drawn: the code already matches (`DownloadScreen.vue` renders `LandingFooter`), so there is nothing left to
build.

- [x] Landing · Download page (`jv9Tp`), Components · Landing (`Uk4Lh`): new `Row · Footer` (`HnJop`) holding the two
  components below.
- [x] Landing / Footer (`AEV5m`): new component, a copy of the desktop footer `jPtzV`, width 1440.
- [x] Landing / Footer · mobile (`GxJaR`): new component, a copy of the mobile footer `yiS37`, width 390.
- [x] Landing — githq.dev (`JJOFX`): hand-drawn `Footer` (`jPtzV`, with `sVGj0` from round 1) → instance `Footer`
  (`J9olfl`) of `Landing / Footer`.
- [x] Landing — githq.dev (mobile) (`ucqck`): hand-drawn `Footer` (`yiS37`, with `TsjoT` from round 1) → instance
  `Footer` (`e6jOzH`) of `Landing / Footer · mobile`.
- [x] `LP17 · /download · macOS visitor` (`F9LYO`): new `Footer` (`Weopg`), an instance of `Landing / Footer`, after
  `Main`; 1231 → 1574 px tall.
- [x] `LP18 · /download · Phone` (`F3bWNG`): new `Footer` (`i2POJP`), an instance of `Landing / Footer · mobile`, after
  `Main`; 1533 → 1943 px tall.
- [x] `LP19 · /download · Signed in` (`HJ6xc`): new `Footer` (`cgXAv`), an instance of `Landing / Footer`, after
  `Main`; 391 → 734 px tall.
