import type { DiffLineSide } from '../diff/buildDiffRows.js';

/** Lines of a file a comment is being written on, each range on one side. */
export type CommentedLines = readonly {
    readonly side: DiffLineSide;
    readonly start: number;
    readonly end: number;
}[];

/**
 * Whether a comment is being written on the line.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isLineCommented(ranges: CommentedLines, side: DiffLineSide, line: number): boolean {
    return ranges.some(range => range.side === side && range.start <= line && line <= range.end);
}
