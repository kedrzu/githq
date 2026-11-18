import type { ReadingStopBox } from './ReadingCursor.js';

/**
 * The stop at a position, from the content's top: the innermost whose box holds it, as `closest()` answers for the
 * pointer, so the keys and the pointer agree; in a gap between stops, the last one starting above it. `null` above
 * every stop.
 *
 * @param stops In document order, so a stop nested in another comes after it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findStopAt(stops: readonly ReadingStopBox[], y: number): ReadingStopBox | null {
    const holding = stops.findLast(stop => stop.top <= y && y < stop.bottom);
    if (holding) {
        return holding;
    }

    let above: ReadingStopBox | null = null;
    for (const stop of stops) {
        if (stop.top <= y && (above === null || stop.top >= above.top)) {
            above = stop;
        }
    }

    return above;
}
