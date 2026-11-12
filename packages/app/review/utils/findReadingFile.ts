/** A row on screen of a file, its edges measured from the viewport's top. */
export interface ReadingFileRow {
    readonly path: string;
    /** Where the file's block ends in this row: the room between files is not the file's. */
    readonly bottom: number;
}

/**
 * The file being read (D44): the one whose block crosses the reading line. The room between two files belongs to the
 * one below, the file coming next; past the last row, the last file is read. A pure function of where the rows are,
 * so the current file changes once at a boundary and never flickers back.
 *
 * @param rows The rows on screen, top to bottom.
 * @param line The reading line, from the viewport's top (`getReadingLine`).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findReadingFile(rows: readonly ReadingFileRow[], line: number): string | null {
    for (const row of rows) {
        if (row.bottom > line) {
            return row.path;
        }
    }

    return rows.at(-1)?.path ?? null;
}
