# Usage statistics

githq counts, anonymously, sign-ins, token renewals, sign-outs and installer downloads (only the event name and the
client), and Cloudflare Web Analytics counts landing and docs visits. A switch in a new Settings section, Privacy,
turns it off for the account; the landing says so in one line. Spec: `.context/specs/2026-11-13-telemetry.md`.
Base: `eed80d64`.

## Round 1 · agent brief

Asked: a Settings · Privacy screen built like Display (one switch row and a link to the docs), Privacy in the sections
column between Code review and Sync settings, one sentence on the landing card "No server holds your work".
Changed: one new screen, a row in the shared sections column, the landing card's body on desktop and mobile.

- [ ] App · Settings (`i3VkT`): new slot `Slot · T23 · Settings · Privacy` (`aDEzM`), screen `T23 · Settings · Privacy`
  (`HcYRX`), built from Display's screen. Page header "Privacy"; Privacy selected in the column (`rfGaZ`). One
  switch row (`ptsdC`, in `YEWMf`) at Display's row position and width, Switch on: title "Share usage statistics",
  description "githq counts sign-ins, anonymously, so we know how many people use it. Nothing about your code, your
  repositories or who you are is ever sent." Below it, 14 px apart, the link `p8est3` "What githq counts" in the
  style of "Repository settings on GitHub" (accent text, `arrow-up-right`), to the docs page on what is counted.
- [ ] Settings / Sections column (`Hx88c`): new row "Privacy" (`nTco9`), lucide `shield`, key 5, between Code review
  and Sync settings. Keys after it shift: Sync settings (`L2bl9`) 5 → 6, Account
  (`as5l2`) 6 → 7, Updates (`NJNWb`) 7 → 8, Changelog (`XRz95`) 8 → 9. Component: all 24 Settings screens get it.
- [ ] Landing — githq.dev (`JJOFX`), card "No server holds your work" (`iJEkD`), body `w7W7B`: appended "It only
  counts sign-ins, anonymously, and you can turn even that off in Settings." The row of cards stays 260 px, equal
  heights (190 of 196 px used).
- [ ] Landing — githq.dev (mobile) (`ucqck`), card `N0I4y`, body `Aboe8`: the same sentence; the card grows 46 px.

## Round 2 · agent brief

Asked: Privacy in the phone's list of sections, and the stale note above the Settings group.

- [ ] Phone / Settings / Sections (`m35OG`): new row "Privacy" (`WNwK3`, `Phone / Settings / Row`, `shield`) after
  Code review, closing the group "How githq behaves"; value "Statistics on" like Display's "Animations on". Its one
  instance is on `MB146 · Settings · The list of sections` (`emdbK`); the list grows 453 → 505 px and still fits.
- [ ] Group note (`Vtt0e`): "six sections" → "seven sections", "Keys 1 to 6" → "Keys 1 to 7", and "Privacy" named
  between Code review and Sync settings in its list.
