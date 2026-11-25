import type { AnchoredListShownRow, AnchoredListViewport } from '../AnchoredList.vue';
import type { ReviewRow } from '../buildReviewRows.js';
import { listCursorStops } from './listCursorStops.js';
import type { IsThreadWhole } from './listCursorStops.js';
import type { ReviewCursor } from './ReviewCursor.js';

/** Where a comment of a thread shows, its edges from the viewport's top as `AnchoredList`'s rows'. */
export interface ReviewCommentBox {
    readonly top: number;
    readonly bottom: number;
}

export interface FindCursorOnScreenParams {
    /** The rows on screen, top to bottom (`AnchoredList`'s `getShownRows`). */
    readonly rows: readonly AnchoredListShownRow<ReviewRow>[];
    readonly viewport: AnchoredListViewport;
    readonly edge: 'top' | 'bottom';
    readonly isThreadWhole: IsThreadWhole;
    /** Where a comment of a thread shown whole is; `null` for one not drawn, which takes its thread's box. */
    readonly getCommentBox: (key: string, comment: string) => ReviewCommentBox | null;
}

/**
 * The stop at an edge of what shows (D44): the first wholly under the pinned header or the last wholly above the bottom,
 * where a scroll brings a cursor about to leave the screen and where the review opens; a comment of a thread shown whole by
 * its own box. With none whole, as a thread taller than the screen, the first or last showing at all. `null` with no stop
 * on screen.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCursorOnScreen({
    rows,
    viewport,
    edge,
    isThreadWhole,
    getCommentBox,
}: FindCursorOnScreenParams): ReviewCursor | null {
    const stops = rows
        .flatMap(shown =>
            listCursorStops(shown.row, isThreadWhole).map(stop => {
                const box = (stop.comment === undefined ? null : getCommentBox(stop.key, stop.comment)) ?? shown;
                return { stop, top: box.top, bottom: box.bottom };
            }),
        )
        .filter(shown => shown.bottom > viewport.covered);
    const found =
        edge === 'top'
            ? (stops.find(shown => shown.top >= viewport.covered) ?? stops[0])
            : (stops.findLast(shown => shown.bottom <= viewport.height) ?? stops.at(-1));
    return found?.stop ?? null;
}
