/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getLogLineParts, MAX_SHOWN_CHARACTERS } from './getLogLineParts.js';

test('a line with nothing to highlight is one part', () => {
    expect(getLogLineParts('all fine')).toEqual({ parts: [{ text: 'all fine', highlighted: false }], hidden: 0 });
    expect(getLogLineParts('')).toEqual({ parts: [], hidden: 0 });
});

test('a line splits at the ranges to highlight', () => {
    const { parts } = getLogLineParts('error: build failed', [
        { start: 0, end: 5 },
        { start: 13, end: 19 },
    ]);

    expect(parts).toEqual([
        { text: 'error', highlighted: true },
        { text: ': build ', highlighted: false },
        { text: 'failed', highlighted: true },
    ]);
});

test('a very long line is cut to what is laid out, saying how much is left, whatever is highlighted past the cut', () => {
    const text = 'x'.repeat(1_000_000);
    const { parts, hidden } = getLogLineParts(text, [
        { start: MAX_SHOWN_CHARACTERS - 1, end: MAX_SHOWN_CHARACTERS + 5 },
        { start: 500_000, end: 500_001 },
    ]);

    expect(parts.map(part => part.text.length).reduce((sum, length) => sum + length)).toBe(MAX_SHOWN_CHARACTERS);
    expect(parts.at(-1)).toMatchObject({ highlighted: true });
    expect(hidden).toBe(1_000_000 - MAX_SHOWN_CHARACTERS);
});
