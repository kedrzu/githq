import { findStopAt } from './findStopAt.js';
import type { ReadingStopBox } from './ReadingCursor.js';

/** How far a press of ↓ ↑ moves the reading cursor: about two lines. A parent's tail shorter than this is no stop. */
export const LINE_STEP = 40;

export interface StepCursorParams {
    /** In document order; at least one. */
    readonly stops: readonly ReadingStopBox[];
    /** Where the cursor is, from the content's top. */
    readonly y: number;
    /** How far to go, down if positive. */
    readonly distance: number;
    /** A line (↓ ↑) never passes a stop's top, so each stop is reached by a press of its own; a page (PageDown PageUp) does. */
    readonly by: 'line' | 'page';
}

/**
 * Where the reading cursor goes from `y`: so far down or up, a line no further than the next stop's top going down or
 * the nearest stop's top above it going up, so no stop is passed over and a tall one takes several presses. A line down
 * that would end in a gap between stops goes on to the next stop's top: the cursor stands on a stop, so in a gap wider
 * than a line it would be held at the stop above's end, every press landing in the gap again. A line
 * never lands in a parent's tail after its last nested stop shorter than {@link LINE_STEP} (a card's padding): the
 * marking would go back to the parent for a press. Never above the first stop's top nor below the last stop's end, so
 * at the content's ends it stays on the first or last stop.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function stepCursor({ stops, y, distance, by }: StepCursorParams): number {
    let target = y + distance;
    let first = Infinity;
    let end = -Infinity;
    let nextTop: number | null = null;
    for (const stop of stops) {
        first = Math.min(first, stop.top);
        end = Math.max(end, stop.bottom - 1);
        if (by === 'line' && distance > 0 && stop.top > y) {
            target = Math.min(target, stop.top);
            nextTop = Math.min(nextTop ?? Infinity, stop.top);
        } else if (by === 'line' && distance < 0 && stop.top < y) {
            target = Math.max(target, stop.top);
        }
    }

    target = Math.min(Math.max(target, first), end);
    if (
        by === 'line' &&
        distance > 0 &&
        nextTop !== null &&
        !stops.some(stop => stop.top <= target && target < stop.bottom)
    ) {
        return nextTop;
    }

    const tailStart = by === 'line' ? findShortTailStart(stops, target) : null;
    if (tailStart === null) {
        return target;
    }

    // Down to the next stop, or with none no further than the last nested one's end; up to the last nested one's end.
    if (distance > 0) {
        return nextTop ?? Math.max(tailStart - 1, y);
    }

    return tailStart - 1;
}

/** Where the tail holding `y` starts, when `y` is in a parent's tail after its nested stops shorter than a line. */
function findShortTailStart(stops: readonly ReadingStopBox[], y: number) {
    const holding = findStopAt(stops, y);
    if (!holding || y >= holding.bottom) {
        return null;
    }

    let lastChildEnd: number | null = null;
    for (const stop of stops.slice(stops.indexOf(holding) + 1)) {
        if (stop.top >= holding.bottom) {
            break;
        }

        lastChildEnd = Math.max(lastChildEnd ?? -Infinity, stop.bottom);
    }

    return lastChildEnd !== null && y >= lastChildEnd && holding.bottom - lastChildEnd < LINE_STEP
        ? lastChildEnd
        : null;
}
