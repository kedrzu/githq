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

## Round 3 · agent brief

Asked (owner): boolean settings become framed cards clickable as a whole, like the `ChoiceCards` of the repository
layout, with hover and keyboard focus states and a variant holding a link; applied to every boolean settings row; the
Privacy link inside the card as a separate target; copy that admits the landing counts visits.
Changed: the switch row component became the toggle card, with its states; T23's row and link became one card; the
landing line on desktop and mobile. "On" looks like "off" but for the Switch: the card keeps ChoiceCards' resting
frame, because a setting that is on is not a selected option and a page of accent frames would be loud. Hover is
ChoiceCards' own (`$border` → `$border-2`). Focus on the Switch rings the whole card (2 px `$accent`, drawn in place
of the border; in code `focus-ring` outside it, the Switch's own ring hidden).

- [ ] Settings / Switch row → `Settings / Toggle card` (`AQNxV`, the base, Switch on): framed like ChoiceCards'
      rows (`$border` 1 px, radius 8, padding 12/14), title and description left, Switch right, centred vertically; a
      hidden link in the description (`Xve0U`, text `XO9HU`, icon `Axiqd`; accent text, `arrow-up-right`). Its
      instances follow: `CH43 · Settings · Display`'s Animations (`QuuTp`, on) and `CH49 · … · Animations off`
      (`LJ76b`).
- [ ] `Settings / Toggle card · off` (`W2FH3n`): renamed from the switch row's off variant.
- [ ] New `Settings / Toggle card · hover` (`B8viX`): border `$border-2`.
- [ ] New `Settings / Toggle card · focus` (`n1uY0V`): 2 px `$accent` ring around the card.
- [ ] New `Settings / Toggle card · with link` (`iahCE`): the link shown.
- [ ] New sheet `Settings / Toggle card · states` (`t2fEAy`) in `Components · Settings` (`q9BSr`), fill `$bg`,
      padding 24, the five states captioned; `Components · Settings` gets a fixed width 6331 so the frame contains it
      (`App · Settings` now ends at x 16571, 581 px before `App · States`).
- [ ] `T23 · Settings · Privacy` (`HcYRX`): row `ptsdC` and link `p8est3` removed → one `· with link` card
      (`eYLKE`, Switch on), the link "What githq counts ↗" inside it. Description: "githq counts sign-ins, anonymously,
      …" → "githq counts sign-ins and visits anonymously, so we know how many people use it. Nothing about your code,
      your repositories or who you are is ever sent."
- [ ] New `Workflow alerts / Default branch · hover` (`ltWOr`, in `App · Workflows`): the default branch row with
      `$bg-3`. The row stays a row of the alerts list card (no card in a card); T16 and W7–W12 unchanged.
- [ ] Landing — githq.dev, body `w7W7B`: "It only counts sign-ins, anonymously, and you can turn even that off in
      Settings." → "It counts visits and sign-ins anonymously, never your work, and you can turn that off in Settings."
      Still five lines; the card row stays 260 px.
- [ ] Landing — githq.dev (mobile), body `Aboe8`: the same sentence; the card grows 23 px, the sections below move
      down.

Not changed: "Open links in the desktop app" is drawn on no Settings screen; `Phone / Settings / Switch row` stays a
row of the phone's grouped list, the whole row already the target; the code review toolbar switch.

## Round 4 · agent brief

Asked (owner): the Switch of the toggle card goes to the top-right corner, aligned to the title's line, not centred
vertically in the card. Changed: the base only; the variants and every instance inherit it.

- [ ] `Settings / Toggle card` (`AQNxV`): `alignItems` `center` → `start`; the Switch (`dBU9c`, 16 px) sits at the top
      padding, its centre on the title's 16 px line. `· off` (`W2FH3n`), `· hover` (`B8viX`), `· focus` (`n1uY0V`),
      `· with link` (`iahCE`) and the instances (T23 `eYLKE`, `CH43` `QuuTp`, `CH49` `LJ76b`) follow.
