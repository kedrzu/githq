Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/aloof-dingo/githq.pen

A link to a comment (`…/issues/12#issuecomment-5`) opens the item scrolled to that comment (#248). While the address
names the comment, the comment is outlined, as GitHub marks a comment it was linked to.

- [ ] App · Pull request (`XN8vf`): new row with `Slot · F17 · A comment linked from the address` (`q73pJ`): the item
  view's Latest activity with the middle of three comments linked (left), and the same mark on the thread's card
  (right).
- [x] The linked comment in Latest activity (`ItemActivity.vue`, `.itemActivity_comment`): an outline only, drawn
  outside the comment so nothing moves, neither the comment's own content nor its neighbours.
  - Border: 1 px `$color-accent`. No background: the comment stays on the item's surface.
  - Radius: `$radius-lg` (8 px).
  - Distance from the content (the "padding"): `$spacing-6` above and below, `$spacing-8` left and right, the left
    edge 8 px before the avatar. Build it as a `::before` on the comment (`position: relative` on the `li`, then
    `position: absolute; inset: -#{$spacing-6} -#{$spacing-8}; border: 1px solid $color-accent; border-radius:
    $radius-lg; pointer-events: none`), not as padding or a border on the comment itself. The list's gap stays
    `$spacing-12`, so the outline ends halfway to the next comment.
  - The same in the panel, the modal and the page: it depends only on the comment.
  - It stays while the fragment is in the address, and goes with it (K/J, another item, closing). No animation, no
    new text.
- [ ] The linked comment in the thread (`Activity / Comment`, as the thread replaces Latest activity): the card's border
  `$border-2` → `$accent`, nothing else. The card already has a border, so nothing moves.
- [ ] App · Pull request · `Components · Activity` · `Comments and reviews` (`rOA90`): new components.
  - `Avatar / medium` (`mxoOS`): `Avatar` at 22 × 22, radius 11, initials 8.5, as the app's `Avatar` `md`.
  - `Activity / Latest comment` (`cK3wW`): the comment row as `ItemActivity.vue` draws it: avatar, gap 10, then the
    meta line (author 12.5 / 500 `$fg`, age 12 `$fg-dim`, a hidden `edited`) and the body 13.5, line height 1.6.
    In the file it carries 6 / 8 px of padding and a transparent 1 px inner stroke, so the outline has room; in code
    that space is the `::before`'s, outside the comment, as above.
  - `Activity / Latest comment · linked` (`xG3Wm`): an instance of it with the stroke `$accent`.
  - `Activity / Comment · linked` (`iMK9U`): an instance of `Activity / Comment` (`WHy4W`) with the card's stroke
    `$accent`.
