# Review comment width

On a wide screen a review's threads and comment boxes ran across the whole half or file, in lines too long to read,
and a thread whose line is gone took the file's whole width even in split. Now every one is at most 760 px wide, and
the gone-line thread sits on its side's half (D24 and D30, amended 2026-11-13). Base: `8eba0ff2`.

## Round 1 · agent brief, made with the implementation

Asked: CR10 on the right half like any thread; no thread or comment box wider than 760 px. Changed: App · Code review
(`CEDLB`) only, no components.

- [x] CR10 Line gone (`ukHYI`): one column across the file → two halves, gap 0, padding 0; new Before side (`X3BRn`,
  empty) and After side (`tvCep`, 1 px `$border` divider on its left) holding the Head (`beqcG`), Code as commented
  (`k7pzD`) and the Thread (`Xssat`), which went from 1024 px to the half.
- [x] CR10 Head (`beqcG`): one centred line → a stack, the new Title row (`u4UtAs`, icon `v9xb3` and `YXKoZ`) above
  the wrapping detail (`p5EmyT`, auto → fixed width).
- [x] CR12, CR14, CR63, CR81: a 760 px Content frame (`oOzm2`, `P70lk`, `pBmg1`, `tNV49`) inside each thread piece
  holds its code and thread (1024 → 760 px); CR63's distance line stays at the file's width, being its own row.
- [x] CR93 Comment boxes (`S7brmA`, `JBhyD`) and CR119 Comment box (`tl9eY`): fill → 760 px.
