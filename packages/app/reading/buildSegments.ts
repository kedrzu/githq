import { findStopAt } from './findStopAt.js';
import type { ReadingSegment, ReadingStopBox } from './ReadingCursor.js';
import { LINE_STEP } from './stepReading.js';

/**
 * What the reading cursor stands on, in document order, from the first stop's top to the last one's end without a
 * break: the content cut at every stop's top and bottom, each piece owned by the innermost stop holding it as
 * `findStopAt` answers (a gap by the stop above it), neighbours of one stop merged. A piece not starting at its own
 * stop's top (a parent's tail after its nested stops, a gap) shorter than {@link LINE_STEP} joins the segment before
 * it: a card's padding is no place to stop at. A stop shorter than that is still a segment of its own (an event's line).
 *
 * @param stops In document order, so a stop nested in another comes after it.
 * @__NO_SIDE_EFFECTS__
 */
export function buildSegments(stops: readonly ReadingStopBox[]): ReadingSegment[] {
    const cuts = [...new Set(stops.flatMap(stop => [stop.top, stop.bottom]))].toSorted((a, b) => a - b);
    const pieces: ReadingSegment[] = [];
    let start: number | null = null;
    for (const end of cuts) {
        const owner = start === null ? null : findStopAt(stops, start);
        const last = pieces.at(-1);
        if (start !== null && owner) {
            if (last?.key === owner.key) {
                pieces[pieces.length - 1] = { ...last, end };
            } else {
                pieces.push({ key: owner.key, kind: owner.kind, start, end });
            }
        }

        start = end;
    }

    const tops = new Map<string, number>();
    for (const stop of stops) {
        tops.set(stop.key, stop.top);
    }

    const segments: ReadingSegment[] = [];
    for (const piece of pieces) {
        const last = segments.at(-1);
        const isShortTail = piece.start !== tops.get(piece.key) && piece.end - piece.start < LINE_STEP;
        if (last && (last.key === piece.key || isShortTail)) {
            segments[segments.length - 1] = { ...last, end: piece.end };
        } else {
            segments.push(piece);
        }
    }

    return segments;
}
