import { expect, test } from 'bun:test';

import { getReadingLine } from './getReadingLine.js';

const HEADER = 38;
const HEIGHT = 600;

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
