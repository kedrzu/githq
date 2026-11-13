# Conversation cards

Code review's conversation sidebar shows the description, reviews and comments with the same cards as the pull
request's thread, with the same ⋯ menu, sending and refused states and editing in place; replies inside code threads
stay flat. The sidebar becomes resizable from its inner edge (min and default 340 px, kept on the device). Because it
can be that narrow, the cards gain a narrow layout chosen by the width of their container (a container query), not
the window. Base: `d4dcc9c4`.

## Round 1 · agent brief

Asked: narrow variants of the comment, description and review cards and their states; code review screens at 340 px,
dragged wide, with the ⋯ menu open, editing in place, sending and refused, and a very long login.

Changed: hidden narrow-only parts on the base cards (invisible on the wide cards, which render as before); narrow
variants built as instances of the wide ones; `Review / Conversation` rebuilt from the narrow cards, so every code
review screen with the conversation on shows them; seven new screens, CR120–CR126, one an amber question.

Decisions taken in this round:

- The narrow layout applies below 480 px of thread width: no gutter, a 20 px avatar before the login, the verb drops,
  the age stays, the ⋯ stays at the end. When the head is still too tight the login truncates with an ellipsis; on the
  description the Author chip drops before the login is cut.
- A review's head tail ("2 threads · 1 resolved", "Show review") moves to one line in the body right under the
  summary (`Activity / Threads link`): the head stays the single 36 px band every card has. In the sidebar the
  threads live in the diff, so that line is the jump ("2 threads in files ↘") at either width, and the wide head
  drops its count there.
- Narrow review cards get a ⋯; whether the wide one should too is CR126's question.
- Skipped: the optional item panel at ~420 px.

Components (`Components · Activity`, `X7uA3I`, in `App · Pull request`):

- [ ] Components · Activity (`X7uA3I`): new row `Narrow cards` (`wuC1d`) with a note on the narrow rule and the
      components below.
- [ ] Activity / Threads link (`Ul90Y`): new component, the thread count line with its ↘ jump (from the
      `Review / Summary` line).
- [ ] Activity / Comment (`WHy4W`): hidden 20 px `Avatar` (`AMSoi`) added first in the head; the wide card is
      unchanged.
- [ ] Activity / Review (`b1us0`): hidden `More` ⋯ (`e9fnT9`) added at the end of the head, hidden `Threads link`
      (`bOJMx`) added in the body after the summary; the wide card is unchanged.
- [ ] Item / Body (`bJhAe`): hidden 20 px `Avatar` (`r10C3a`) added first in the head, hidden `Show more`
      ("Show description", `ZyhJ7`) added at the end of the content; the wide card is unchanged.
- [ ] Activity / Comment · narrow (`k6csA`): new, instance of `Activity / Comment`.
- [ ] Activity / Comment · narrow, sending (`x9F0Cq`): new, instance of `Activity / Comment · sending`.
- [ ] Activity / Comment · narrow, failed (`ufFmh`): new, instance of `Activity / Comment · failed`; the reason wraps
      to two lines, Discard and Retry keep their size.
- [ ] Activity / Editor tools · folded (`xvz0F`): new, instance of `Activity / Editor tools · review, folded` without
      Suggest a change.
- [ ] Activity / Comment · narrow, editing (`DFWqj`): new, instance of `Activity / Comment · editing` without the
      gutter, its formatting tools folded into ⋯.
- [ ] Item / Body · narrow (`DSsUo`): new, instance of `Item / Body`, the Author chip kept.
- [ ] Item / Body · narrow, folded (`a7snnS`): new, five lines and Show description.
- [ ] Activity / Review · narrow (`WUD8Y`): new, changes requested, with a code thread at 280 px (excerpt, flat
      replies, Reply…, Resolve); its resolved-threads row hides the path and avatars to fit.
- [ ] Activity / Review · narrow, approved (`Hs0KC`), · narrow, commented (`aolHQ`), · narrow, dismissed (`BA1U1`):
      new, instances of the wide variants; dismissed puts Show review in the body line.

Code review (`App · Code review`, `CEDLB`):

- [ ] Review / Conversation (`sf3K6`): the flat description, `Review / Summary` and `Review / Comment` rows → narrow
      cards (folded description, sofiab's changes-requested review with "2 threads in files ↘", dkim's approval,
      claude[bot]'s and sofiab's comments, a comment of the viewer's own); the separator rule and the spacer removed;
      `Items` fills the column and clips, so the composer stays at the foot; gap 18 → 6 between cards (each card adds
      its own 6 px), padding 14 → 8/14/14/14; hidden `Resize edge` (`t4cZR`), a 2 px accent line on the inner edge.
      Every screen with the conversation on (CR2, CR5, CR82 and the rest) now shows the cards.
- [ ] `Review / Summary` (`jHkgH`) is no longer used by the sidebar; left in place.
- [ ] New group header `The conversation as cards` (`TT4mn`) and two rows of screens (`DbUdM`, `rlXs1`).
- [ ] New `CR120 · The conversation at 340 px, as cards` (`S8Ol7`), a laptop screen.
- [ ] New `CR121 · Dragged to 560 px: the cards widen` (`A4kcAD`): the edge lit, the wide cards, the threads jump kept.
- [ ] New `CR122 · ⋯ on your comment: the same menu` (`vVNwm`).
- [ ] New `CR123 · Editing your comment in place` (`F3O3m5`).
- [ ] New `CR124 · Your comment sending, and one refused` (`YQPcq`).
- [ ] New `CR125 · A very long login on a review` (`EgvuT`).
- [ ] New `CR126 · Question · The ⋯ of a review card` (`ERZS9`), amber: should the wide review card get the ⋯ too?

Canvas:

- [ ] The 25 top-level frames from `App · Command menu` down (y ≥ 56076) moved 2270 px down, keeping 1200 px below
      the taller `App · Code review`.

## Round 2 · owner's answers

Asked: the owner accepted the round and CR126's recommendation (⋯ on review cards at every width, Quote reply and Copy
link). Checked the owner's note on panel separators: every separator of the code review screens is `$border` at 1 px,
none doubled (a 4× export shows the file list's and the conversation's lines identical); the difference seen in the
app comes from zoom antialiasing. In code, the conversation's own `border-left` goes once `ColumnSplit` draws the line.

- [ ] Activity / Review (`b1us0`): `More` ⋯ (`e9fnT9`) shown on every review card, wide too; hidden on
      `Activity / Review · pending` (`PwdqU`), a draft not on GitHub yet.
- [ ] CR126 (`ERZS9`, `QNbcB`): settled — `Question ·` and the amber dropped, the caption says the rule.
