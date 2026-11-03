import { lcs } from 'fast-myers-diff';

import { splitLines } from './splitLines.js';

export interface ComputeFileDiffParams {
    /** The file's content before, `null` where it does not exist. */
    readonly before: string | null;
    /** The file's content after, `null` where it does not exist. */
    readonly after: string | null;
    /** Compare lines with all whitespace removed (D4); they still display their real text. */
    readonly ignoreWhitespace: boolean;
}

/** The same place in both versions of a file, in 0-based indices into its lines, each end exclusive. */
export interface DiffRange {
    readonly beforeStart: number;
    readonly beforeEnd: number;
    readonly afterStart: number;
    readonly afterEnd: number;
}

/** Both versions of a file, by line without its line ending, and what changed between them. */
export interface FileDiff {
    readonly before: readonly string[];
    readonly after: readonly string[];
    /** The changed places in file order, never touching each other. A range empty on one side is a pure addition or deletion. */
    readonly blocks: readonly DiffRange[];
}

/**
 * Diffs a file's content before and after (D6), `null` being the side where the file does not exist. A carriage return
 * is displayed by no line but compares like any other character, so line endings converted from CRLF to LF are a change
 * of every line, as on github.com, unless whitespace is ignored. A final newline is no line of its own and no difference.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function computeFileDiff({ before, after, ignoreWhitespace }: ComputeFileDiffParams): FileDiff {
    const beforeLines = splitLines(before);
    const afterLines = splitLines(after);

    // Comparing integers instead of strings is what keeps a large file's diff fast.
    const ids = new Map<string, number>();
    const beforeIds = internLines(beforeLines);
    const afterIds = internLines(afterLines);

    // A line the other side doesn't have can't be common to both, so leaving it out keeps the diff minimal, and turns
    // Myers' worst case, a file rewritten, into its best. `lcs` trims the common prefix and suffix itself.
    const beforeShared = keepLinesIn(beforeIds, new Set(afterIds));
    const afterShared = keepLinesIn(afterIds, new Set(beforeIds));

    // The changed places are what lies between the lines in common, in the whole files.
    const blocks: DiffRange[] = [];
    let beforeStart = 0;
    let afterStart = 0;
    for (const [beforeRun, afterRun, length] of lcs(beforeShared.ids, afterShared.ids)) {
        for (let offset = 0; offset < length; offset++) {
            closeBlock(beforeShared.lines[beforeRun + offset] ?? 0, afterShared.lines[afterRun + offset] ?? 0);
            beforeStart++;
            afterStart++;
        }
    }

    closeBlock(beforeLines.length, afterLines.length);

    return { before: beforeLines.map(stripCarriageReturn), after: afterLines.map(stripCarriageReturn), blocks };

    /** Ends the changed place before these lines, if there is one, and moves up to them. */
    function closeBlock(beforeEnd: number, afterEnd: number) {
        if (beforeEnd > beforeStart || afterEnd > afterStart) {
            blocks.push({ beforeStart, beforeEnd, afterStart, afterEnd });
        }

        beforeStart = beforeEnd;
        afterStart = afterEnd;
    }

    function internLines(lines: readonly string[]): Int32Array {
        const lineIds = new Int32Array(lines.length);
        for (const [index, line] of lines.entries()) {
            const content = ignoreWhitespace ? line.replace(/\s+/g, '') : line;
            let id = ids.get(content);
            if (id === undefined) {
                id = ids.size;
                ids.set(content, id);
            }

            lineIds[index] = id;
        }

        return lineIds;
    }
}

/** The lines whose id is among those given: their ids, and where each is in the file. */
function keepLinesIn(ids: Int32Array, kept: ReadonlySet<number>) {
    const keptIds: number[] = [];
    const lines: number[] = [];
    for (const [line, id] of ids.entries()) {
        if (kept.has(id)) {
            keptIds.push(id);
            lines.push(line);
        }
    }

    return { ids: keptIds, lines };
}

function stripCarriageReturn(line: string): string {
    return line.endsWith('\r') ? line.slice(0, -1) : line;
}
