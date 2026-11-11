import { expect, test } from 'bun:test';

import type { ReadingFileRow } from './findReadingFile.js';
import { findReadingFile } from './findReadingFile.js';
import { getReadingLine } from './getReadingLine.js';

const HEADER = 38;
const GAP = 8;
const LINE = 20;
const HEIGHT = 600;

test('gives the room between two files to the file below', () => {
    const rows: ReadingFileRow[] = [
        { path: 'a.ts', bottom: 100 },
        { path: 'b.ts', bottom: 300 },
    ];

    expect(findReadingFile(rows, 99)).toBe('a.ts');
    expect(findReadingFile(rows, 100)).toBe('b.ts');
    expect(findReadingFile(rows, 104)).toBe('b.ts');
});

test('reads the last file past the last row, and none with no rows', () => {
    expect(findReadingFile([{ path: 'a.ts', bottom: 100 }], 500)).toBe('a.ts');
    expect(findReadingFile([], 100)).toBeNull();
});

test('slides the reading line to the bottom edge at the end of the diff and to the top edge at its start', () => {
    const covered = HEADER;
    const line = covered + (HEIGHT - covered) / 3;

    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 1000, remaining: 1000 })).toBe(line);
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 1000, remaining: 0 })).toBe(HEIGHT);
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 1000, remaining: 100 })).toBe(HEIGHT - 100);
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 0, remaining: 1000 })).toBe(0);
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 50, remaining: 1000 })).toBe(50);
    // Scrolling less than a viewport: evenly from one edge to the other.
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 100, remaining: 200 })).toBe(200);
    // Not scrolling at all: where it is.
    expect(getReadingLine({ height: HEIGHT, covered, scrolled: 0, remaining: 0 })).toBe(line);
});

test('makes every file current at some point of scrolling through, a run of headers and the last short files too', () => {
    const files = [
        ...range(4).map(index => ({ path: `lock-${index}`, lines: 0 })),
        { path: 'big.ts', lines: 80 },
        ...range(6).map(index => ({ path: `generated-${index}`, lines: 0 })),
        { path: 'middle.ts', lines: 40 },
        { path: 'short-1.ts', lines: 1 },
        ...range(3).map(index => ({ path: `viewed-${index}`, lines: 0 })),
        { path: 'short-2.ts', lines: 2 },
    ];
    expect(collectCurrent(files)).toEqual(files.map(file => file.path));
});

test('makes every file current in a diff scrolling less than a viewport', () => {
    const files = range(12).map(index => ({ path: `file-${index}`, lines: index % 3 === 0 ? 0 : 3 }));
    expect(collectCurrent(files)).toEqual(files.map(file => file.path));
});

interface LaidFile {
    readonly path: string;
    /** 0 for a file shown as its header only. */
    readonly lines: number;
}

/** The current files, in the order they become current while scrolling from the top to the end a pixel at a time. */
function collectCurrent(files: readonly LaidFile[]) {
    const rows: (ReadingFileRow & { readonly top: number })[] = [];
    let top = 0;
    for (const { path, lines } of files) {
        rows.push({ path, top, bottom: top + HEADER });
        top += HEADER;
        if (lines > 0) {
            rows.push({ path, top, bottom: top + lines * LINE });
            top += lines * LINE;
        }

        top += GAP;
    }

    const total = top;
    const current: string[] = [];
    for (let scrolled = 0; scrolled <= Math.max(total - HEIGHT, 0); scrolled++) {
        const shown = rows
            .map(row => ({ path: row.path, top: row.top - scrolled, bottom: row.bottom - scrolled }))
            .filter(row => row.bottom > 0 && row.top < HEIGHT);
        const line = getReadingLine({
            height: HEIGHT,
            covered: HEADER,
            scrolled,
            remaining: Math.max(total - HEIGHT - scrolled, 0),
        });
        const path = findReadingFile(shown, line);
        if (path !== null && current.at(-1) !== path) {
            current.push(path);
        }
    }

    return current;
}

function range(count: number) {
    return Array.from({ length: count }, (_, index) => index);
}
