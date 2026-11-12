import type { AnchoredListShownRow, AnchoredListViewport } from '../AnchoredList.vue';
import { getReadingLine } from './getReadingLine.js';

export interface FindNearestShownParams<T, R> {
    /** The rows on screen, top to bottom (`AnchoredList`'s `getShownRows`). */
    readonly rows: readonly AnchoredListShownRow<T>[];
    readonly viewport: AnchoredListViewport;
    /** What a row gives the caller, `null` for a row that doesn't count. */
    readonly pick: (row: T) => R | null;
}

/**
 * What the row nearest the reading line gives, among the rows on screen that give something: the row crossing the line
 * first, then the closest, the upper one of two as close. A row wholly under the pinned header is not read, so it never
 * counts. What C comments on and which gap E opens (D32, D42, D44).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findNearestShown<T, R>({ rows, viewport, pick }: FindNearestShownParams<T, R>): R | null {
    const line = getReadingLine(viewport);
    let nearest: R | null = null;
    let nearestDistance = Infinity;
    for (const { row, top, bottom } of rows) {
        const distance = Math.max(top - line, line - bottom, 0);
        if (bottom <= viewport.covered || distance >= nearestDistance) {
            continue;
        }

        const picked = pick(row);
        if (picked !== null) {
            nearest = picked;
            nearestDistance = distance;
        }
    }

    return nearest;
}
