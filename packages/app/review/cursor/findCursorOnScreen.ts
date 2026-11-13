import type { AnchoredListShownRow, AnchoredListViewport } from '../AnchoredList.vue';
import type { ReviewRow } from '../buildReviewRows.js';
import { isCursorStop } from './isCursorStop.js';
import type { ReviewCursor } from './ReviewCursor.js';

export interface FindCursorOnScreenParams {
    /** The rows on screen, top to bottom (`AnchoredList`'s `getShownRows`). */
    readonly rows: readonly AnchoredListShownRow<ReviewRow>[];
    readonly viewport: AnchoredListViewport;
    readonly edge: 'top' | 'bottom';
}

/**
 * The stop at an edge of what shows (D44): the first wholly under the pinned header or the last wholly above the bottom,
 * where a scroll brings a cursor about to leave the screen and where the review opens. With none whole, as a thread
 * taller than the screen, the first or last showing at all. `null` with no stop on screen.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCursorOnScreen({ rows, viewport, edge }: FindCursorOnScreenParams): ReviewCursor | null {
    const stops = rows.filter(shown => isCursorStop(shown.row) && shown.bottom > viewport.covered);
    const found =
        edge === 'top'
            ? (stops.find(shown => shown.top >= viewport.covered) ?? stops[0])
            : (stops.findLast(shown => shown.bottom <= viewport.height) ?? stops.at(-1));
    return found ? { key: found.row.key } : null;
}
