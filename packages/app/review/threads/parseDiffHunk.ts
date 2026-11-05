/** A line of a comment's `diffHunk`. */
export interface DiffHunkLine {
    /** 1-based; `null` on a line added. */
    readonly oldLine: number | null;
    /** 1-based; `null` on a line deleted. */
    readonly newLine: number | null;
    readonly sign: ' ' | '-' | '+';
    readonly text: string;
}

const HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u;

/**
 * The lines of a comment's `diffHunk` with their numbers, which its `@@` line starts. No lines for a hunk with no such
 * line, as on a `FILE` thread.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseDiffHunk(diffHunk: string): DiffHunkLine[] {
    const [header = '', ...lines] = diffHunk.split('\n');
    const start = HEADER.exec(header);
    if (!start) {
        return [];
    }

    let oldLine = Number(start[1]);
    let newLine = Number(start[2]);
    const parsed: DiffHunkLine[] = [];
    for (const [index, line] of lines.entries()) {
        // "\ No newline at end of file" says something of the line above it; the very last empty one is the hunk's own end.
        if (line.startsWith('\\') || (line === '' && index === lines.length - 1)) {
            continue;
        }

        const text = line.slice(1).replace(/\r$/u, '');
        if (line.startsWith('+')) {
            parsed.push({ oldLine: null, newLine: newLine++, sign: '+', text });
        } else if (line.startsWith('-')) {
            parsed.push({ oldLine: oldLine++, newLine: null, sign: '-', text });
        } else {
            parsed.push({ oldLine: oldLine++, newLine: newLine++, sign: ' ', text });
        }
    }

    return parsed;
}
