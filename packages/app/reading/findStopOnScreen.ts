import type { ReadingBand, ReadingPlace, ReadingStopBox } from './ReadingCursor.js';

export interface FindStopOnScreenParams {
    /** In document order. */
    readonly stops: readonly ReadingStopBox[];
    readonly band: ReadingBand;
    readonly edge: 'top' | 'bottom';
}

/**
 * The cursor on the stop at an edge of what shows (D44): the first starting in the band, or the last ending in it; with
 * none, as a stop taller than the band, the innermost one showing, the cursor where the band starts. `null` with no
 * stop showing.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findStopOnScreen({ stops, band, edge }: FindStopOnScreenParams): ReadingPlace | null {
    const showing = stops.filter(stop => stop.bottom > band.top && stop.top < band.bottom);
    const found =
        (edge === 'top'
            ? showing.find(stop => stop.top >= band.top)
            : showing.findLast(stop => stop.bottom <= band.bottom)) ?? showing.at(-1);
    return found ? { key: found.key, offset: Math.max(band.top - found.top, 0) } : null;
}
