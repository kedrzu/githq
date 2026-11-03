import { diff } from 'fast-myers-diff';

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

    // Comparing integers instead of strings is what keeps a large file's diff fast. `diff` trims the common prefix and suffix itself.
    const ids = new Map<string, number>();
    const beforeIds = internLines(beforeLines);
    const afterIds = internLines(afterLines);

    const blocks: DiffRange[] = [];
    for (const [beforeStart, beforeEnd, afterStart, afterEnd] of diff(beforeIds, afterIds)) {
        blocks.push({ beforeStart, beforeEnd, afterStart, afterEnd });
    }

    return { before: beforeLines.map(stripCarriageReturn), after: afterLines.map(stripCarriageReturn), blocks };

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

function splitLines(text: string | null): string[] {
    if (text === null) {
        return [];
    }

    const lines = text.split('\n');
    if (lines.at(-1) === '') {
        lines.pop();
    }

    return lines;
}

function stripCarriageReturn(line: string): string {
    return line.endsWith('\r') ? line.slice(0, -1) : line;
}
