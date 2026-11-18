import { SCROLL_OFF } from './getCursorScroll.js';
import type { CursorScrollViewport } from './getCursorScroll.js';

/**
 * How far to scroll, down if positive, for a comment `[` `]` stepped to to be read from its start: its top on the line a
 * third of what shows below the pinned header (D44's margin), either way it went. `0` while its top is already between
 * that line and the one a third from the bottom. Never more than the content can scroll.
 *
 * @param top The comment's top, from the viewport's top.
 * @__NO_SIDE_EFFECTS__
 */
export function getCommentScroll(top: number, viewport: CursorScrollViewport): number {
    const { height, covered, scrolled, remaining } = viewport;
    const margin = (height - covered) * SCROLL_OFF;
    const bandTop = covered + margin;
    if (top >= bandTop && top <= height - margin) {
        return 0;
    }

    return Math.min(Math.max(top - bandTop, -scrolled), remaining);
}
