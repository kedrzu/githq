import type { ReadingPlace } from './ReadingCursor.js';

/**
 * Where the reading cursor is on screen, in the viewport's coordinates as `getBoundingClientRect` gives them, to find
 * what else holds it (the code thread around it). `null` with its stop not in the scroller.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getReadingCursorTop(scroller: HTMLElement, cursor: ReadingPlace): number | null {
    const stop = scroller.querySelector(`[data-reading-stop="${CSS.escape(cursor.key)}"]`);
    return stop ? stop.getBoundingClientRect().top + cursor.offset : null;
}
