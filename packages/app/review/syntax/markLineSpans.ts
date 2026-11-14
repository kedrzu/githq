import type { LineMark } from '../find/RowMarks.js';

import type { LineSpan } from './getLineSpans.js';

/** How a stretch of a line is marked by find (D47): a match, the one find is on, or not at all. */
export type LineSpanMark = 'match' | 'current' | null;

/** A stretch of a line marked one way, cut into its spans: a match is drawn as one mark over its tokens' colours. */
export interface MarkedLineSpans {
    readonly mark: LineSpanMark;
    readonly spans: readonly LineSpan[];
}

/**
 * A line's spans cut at its marks' edges, a token a mark starts or ends in split in two of its kind, and grouped by
 * mark, in order: their texts together are exactly the line. Without marks, the spans as they are, in one unmarked
 * stretch. An empty mark marks nothing.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function markLineSpans(spans: readonly LineSpan[], marks: readonly LineMark[]): MarkedLineSpans[] {
    if (marks.length === 0) {
        return [{ mark: null, spans }];
    }

    const stretches: { mark: LineSpanMark; spans: LineSpan[] }[] = [];
    // The mark the last stretch is of: two matches next to each other stay two marks.
    let last: LineMark | null | undefined;
    let next = 0;
    let start = 0;
    for (const span of spans) {
        const end = start + span.text.length;
        let at = start;
        while (at < end) {
            while (next < marks.length && isPassed(marks[next], at)) {
                next++;
            }

            // The next mark, which `at` is either in or before.
            const mark = marks[next] ?? null;
            const inMark = mark !== null && mark.start <= at;
            let to = end;
            if (inMark) {
                to = Math.min(mark.end, end);
            } else if (mark !== null && mark.start < end) {
                to = mark.start;
            }

            const piece: LineSpan = { text: span.text.slice(at - start, to - start), kind: span.kind };
            const of = inMark ? mark : null;
            if (of === last) {
                stretches.at(-1)?.spans.push(piece);
            } else {
                stretches.push({ mark: of && (of.current ? 'current' : 'match'), spans: [piece] });
                last = of;
            }

            at = to;
        }

        start = end;
    }

    return stretches;
}

/** The mark ends before `at`, or marks nothing. */
function isPassed(mark: LineMark | undefined, at: number) {
    return mark !== undefined && (mark.end <= at || mark.end <= mark.start);
}
