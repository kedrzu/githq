import { findSegmentAt } from './findSegmentAt.js';
import { getCursorScroll } from './getCursorScroll.js';
import type { CursorScrollViewport } from './getCursorScroll.js';
import type { ReadingBand, ReadingSegment } from './ReadingCursor.js';

/**
 * The least a press of ↓ ↑ scrolls, about two lines; and the shortest a parent's tail or a gap must be to be a segment
 * of its own (`buildSegments`).
 */
export const LINE_STEP = 40;

/**
 * The least scroll a press makes instead of moving the cursor: the browser scrolls by whole pixels, so a press scrolling
 * less (a start a fraction of a pixel past the line a third from the edge) would move nothing, again and again.
 */
const MIN_SCROLL = 1;

export interface StepReadingParams {
    /** As `buildSegments` gives them; at least one. */
    readonly segments: readonly ReadingSegment[];
    /** The cursor's segment among `segments` (`findCursorSegment`), told by its start. */
    readonly current: ReadingSegment;
    /** What shows now, from the content's top. */
    readonly band: ReadingBand;
    /** The same, as `getCursorScroll` takes it: how far the content can scroll either way. */
    readonly viewport: CursorScrollViewport;
    readonly direction: 'down' | 'up';
}

/** Where a press of ↓ ↑ leaves the reading cursor. */
export interface StepReadingResult {
    /** The cursor's segment after the press: `current` where the press only scrolls. */
    readonly segment: ReadingSegment;
    /** How far to scroll, down if positive; never more than the content can. */
    readonly scroll: number;
}

/**
 * A single press of ↓ ↑: on to the next segment while it starts inside the band a third from the edge the cursor goes
 * toward, the screen scrolling no more than a step (a quarter of what shows, {@link LINE_STEP} at least) to bring it
 * there; otherwise a step's scroll on the segment it is on, no further than brings the next one's start to that line,
 * so a stop taller than the screen is read through. Every press moves the cursor or scrolls: at the content's ends,
 * where nothing scrolls, the cursor goes on to the next segment wherever it is, and past the last or first segment the
 * screen still scrolls, the last keeping a part in sight.
 *
 * A cursor's segment wholly out of the band (a wheel scroll inside a big stop left it on the stop's head) is taken first
 * as the segment at the band's edge it left by.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function stepReading({ segments, current, band, viewport, direction }: StepReadingParams): StepReadingResult {
    const height = band.bottom - band.top;
    const step = Math.max(LINE_STEP, height / 4);
    const from = reanchor(segments, current, band);
    const index = segments.findIndex(segment => segment.start === from.start);

    if (direction === 'down') {
        const next = segments[index + 1];
        const line = band.bottom - height / 3;
        if (!next) {
            const keep = Math.min(LINE_STEP, from.end - from.start);
            const scroll = Math.min(step, viewport.remaining, from.end - keep - band.top);
            return { segment: from, scroll: Math.max(scroll, 0) };
        }

        if (next.start <= line) {
            const scroll = getCursorScroll({
                top: next.start - viewport.scrolled,
                bottom: next.end - viewport.scrolled,
                viewport,
                direction,
            });
            return { segment: next, scroll: Math.min(Math.max(scroll, 0), step) };
        }

        const scroll = Math.min(step, next.start - line, viewport.remaining);
        return scroll >= MIN_SCROLL ? { segment: from, scroll } : { segment: next, scroll: 0 };
    }

    const previous = index > 0 ? segments[index - 1] : undefined;
    const line = band.top + height / 3;
    if (!previous) {
        return { segment: from, scroll: -Math.min(step, viewport.scrolled) };
    }

    // A pixel's tolerance: a ↓ brought a tall segment's start to the line, rounded.
    if (from.start >= line - 1) {
        const scroll = getCursorScroll({
            top: previous.start - viewport.scrolled,
            bottom: previous.end - viewport.scrolled,
            viewport,
            direction,
        });
        return { segment: previous, scroll: Math.max(scroll, -step) };
    }

    const scroll = Math.min(step, line - from.start, viewport.scrolled);
    return scroll >= MIN_SCROLL ? { segment: from, scroll: -scroll } : { segment: previous, scroll: 0 };
}

/** The cursor's segment, or with it wholly out of the band, the segment at the edge it left by. */
function reanchor(segments: readonly ReadingSegment[], current: ReadingSegment, band: ReadingBand) {
    if (current.end <= band.top) {
        return findSegmentAt(segments, band.top) ?? current;
    }

    if (current.start >= band.bottom) {
        return findSegmentAt(segments, band.bottom - 1) ?? current;
    }

    return current;
}
