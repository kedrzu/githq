import { CONTEXT_LINES } from '../buildReviewRows.js';
import type { FileDiff } from '../diff/computeFileDiff.js';

/** The parameters of {@link getSuggestionLines}. */
export interface GetSuggestionLinesParams {
    readonly diff: FileDiff;
    /** 1-based. */
    readonly startLine: number;
    readonly line: number;
    /** A thread stands on its lines already; a new comment GitHub takes only inside a hunk of its diff. */
    readonly mustBeInHunk: boolean;
}

/**
 * The commented lines of the file as it is now, whitespace and all, to suggest a change of (D18): `null` if GitHub wouldn't take
 * a suggestion on them. Its hunks hold {@link CONTEXT_LINES} lines around a change, which is less than can be expanded here.
 * Only the newer side can be changed: the caller knows which side it is on.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getSuggestionLines({
    diff,
    startLine,
    line,
    mustBeInHunk,
}: GetSuggestionLinesParams): readonly string[] | null {
    if (startLine < 1 || line > diff.after.length) {
        return null;
    }

    const lines = diff.after.slice(startLine - 1, line);
    const inHunk = (_: string, offset: number) => {
        const index = startLine - 1 + offset;
        return diff.blocks.some(
            ({ afterStart, afterEnd }) => index >= afterStart - CONTEXT_LINES && index < afterEnd + CONTEXT_LINES,
        );
    };
    return !mustBeInHunk || lines.every(inHunk) ? lines : null;
}

/**
 * A suggestion block with the lines as they are (D18): fenced by more backticks than they hold, or a line of them would end it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatSuggestion(lines: readonly string[]): string {
    const longest = Math.max(2, ...lines.flatMap(line => [...line.matchAll(/`+/gu)].map(([run]) => run.length)));
    const fence = '`'.repeat(longest + 1);
    return `${fence}suggestion\n${lines.join('\n')}\n${fence}`;
}
