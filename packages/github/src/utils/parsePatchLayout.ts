const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** A hunk of a patch, without its text. */
export interface PatchHunk {
    /** The first line it shows of the old version; 0 when the old version has no lines (an added file). */
    readonly beforeStart: number;
    /** The first line it shows of the new version; 0 when the new version has no lines (a deleted file). */
    readonly afterStart: number;
    /** The kind of each of its lines, a character per line: `' '` context, `'-'` deleted, `'+'` added. */
    readonly lines: string;
}

/** Where a patch's hunks are and what kind each of their lines is: its shape, none of its text. */
export interface PatchLayout {
    readonly hunks: readonly PatchHunk[];
}

/**
 * Reads the layout of a unified diff patch, as GitHub's `GET …/pulls/{n}/files` gives it per file: the hunk headers'
 * starts and a line kind per line, so a file can be drawn to its real size before its text is read. A
 * `\ No newline at end of file` marker is not a line; carriage returns are dropped. An empty patch has no hunks.
 *
 * Returns `null` for a patch it cannot read: a line outside a hunk, a header it does not know or a line of no kind.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parsePatchLayout(patch: string): PatchLayout | null {
    const hunks: PatchHunk[] = [];
    let header: RegExpExecArray | null = null;
    let lines = '';
    for (const rawLine of patch.split('\n')) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (line.startsWith('@@')) {
            if (header !== null) {
                hunks.push(readHunk(header, lines));
            }

            header = HUNK_HEADER_PATTERN.exec(line);
            if (header === null) {
                return null;
            }

            lines = '';
            continue;
        }

        // What a trailing newline leaves.
        if (line === '') {
            continue;
        }

        const kind = line[0];
        if (header === null || !(kind === ' ' || kind === '-' || kind === '+' || kind === '\\')) {
            return null;
        }

        if (kind !== '\\') {
            lines += kind;
        }
    }

    if (header !== null) {
        hunks.push(readHunk(header, lines));
    }

    return { hunks };
}

function readHunk(header: RegExpExecArray, lines: string): PatchHunk {
    return { beforeStart: Number(header[1]), afterStart: Number(header[2]), lines };
}
