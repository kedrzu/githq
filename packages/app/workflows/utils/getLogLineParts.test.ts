/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getLogLineParts, MAX_SHOWN_CHARACTERS, WHOLE_LINE_CHUNK } from './getLogLineParts.js';
import type { LogLineParts } from './getLogLineParts.js';

test('a line with nothing to highlight is one part', () => {
    expect(getLogLineParts('all fine')).toEqual({
        chunks: [[{ text: 'all fine', highlighted: false }]],
        hidden: 0,
    });
    expect(getLogLineParts('')).toEqual({ chunks: [[]], hidden: 0 });
});

test('a line splits at the ranges to highlight', () => {
    const parts = partsOf(
        getLogLineParts('error: build failed', {
            ranges: [
                { start: 0, end: 5 },
                { start: 13, end: 19 },
            ],
        }),
    );

    expect(parts).toEqual([
        { text: 'error', highlighted: true },
        { text: ': build ', highlighted: false },
        { text: 'failed', highlighted: true },
    ]);
});

test('a very long line is cut to what is laid out, saying how much is left, whatever is highlighted past the cut', () => {
    const text = 'x'.repeat(1_000_000);
    const lineParts = getLogLineParts(text, {
        ranges: [
            { start: MAX_SHOWN_CHARACTERS - 1, end: MAX_SHOWN_CHARACTERS + 5 },
            { start: 500_000, end: 500_001 },
        ],
    });
    const parts = partsOf(lineParts);
    const { hidden } = lineParts;

    expect(parts.map(part => part.text.length).reduce((sum, length) => sum + length)).toBe(MAX_SHOWN_CHARACTERS);
    expect(parts.at(-1)).toMatchObject({ highlighted: true });
    expect(hidden).toBe(1_000_000 - MAX_SHOWN_CHARACTERS);
});

test('a whole line hides nothing, and a hit past the cut is highlighted in it', () => {
    const text = 'x'.repeat(50_000);
    const lineParts = getLogLineParts(text, { whole: true, ranges: [{ start: 40_000, end: 40_005 }] });

    expect(lineParts.hidden).toBe(0);
    expect(
        partsOf(lineParts)
            .map(part => part.text)
            .join(''),
    ).toBe(text);
    expect(partsOf(lineParts).find(part => part.highlighted)?.text).toBe('xxxxx');
});

test('a whole line is laid out a chunk at a time, nothing lost at the seams', () => {
    const text = 'x'.repeat(WHOLE_LINE_CHUNK * 2 + 10);
    const { chunks, hidden } = getLogLineParts(text, {
        whole: true,
        ranges: [{ start: WHOLE_LINE_CHUNK - 2, end: WHOLE_LINE_CHUNK + 2 }],
    });

    expect(hidden).toBe(0);
    expect(chunks).toHaveLength(3);
    expect(
        chunks
            .flat()
            .map(part => part.text)
            .join(''),
    ).toBe(text);
    // A hit over a seam is marked on both sides of it.
    expect(chunks[0]?.at(-1)).toEqual({ text: 'xx', highlighted: true });
    expect(chunks[1]?.[0]).toEqual({ text: 'xx', highlighted: true });
});

test('a chunk never ends inside a surrogate pair', () => {
    const text = `${'x'.repeat(WHOLE_LINE_CHUNK - 1)}🙂tail`;
    const { chunks } = getLogLineParts(text, { whole: true });

    expect(chunks[0]?.[0]?.text).toHaveLength(WHOLE_LINE_CHUNK - 1);
    expect(chunks[1]?.[0]?.text).toBe('🙂tail');
});

test('bidi and invisible characters become parts of their own, named, the text unchanged', () => {
    const controls = [
        '\u202A',
        '\u202B',
        '\u202C',
        '\u202D',
        '\u202E',
        '\u2066',
        '\u2067',
        '\u2068',
        '\u2069',
        '\u200E',
        '\u200F',
        '\u200B',
        '\u200C',
        '\u200D',
        '\u2060',
        '\uFEFF',
    ];
    for (const control of controls) {
        const code = control.codePointAt(0)?.toString(16).toUpperCase() ?? '';
        expect(partsOf(getLogLineParts(`a${control}b`))).toEqual([
            { text: 'a', highlighted: false },
            { text: control, highlighted: false, control: `U+${code}` },
            { text: 'b', highlighted: false },
        ]);
    }
});

test.each([
    ['soft hyphen', '\u00AD', 'U+AD'],
    ['Arabic letter mark', '\u061C', 'U+61C'],
    ['Mongolian vowel separator', '\u180E', 'U+180E'],
    ['function application', '\u2061', 'U+2061'],
    ['invisible plus', '\u2064', 'U+2064'],
    ['language tag', '\u{E0001}', 'U+E0001'],
    ['first tag character', '\u{E0020}', 'U+E0020'],
    ['last tag character', '\u{E007F}', 'U+E007F'],
])('%s shows as what it is', (_, control, code) => {
    expect(partsOf(getLogLineParts(`a${control}b`))).toEqual([
        { text: 'a', highlighted: false },
        { text: control, highlighted: false, control: code },
        { text: 'b', highlighted: false },
    ]);
});

test('variation selectors stay in the text: a chip at every ⚠️ would be noise', () => {
    expect(partsOf(getLogLineParts('\u26A0\uFE0F'))).toEqual([{ text: '\u26A0\uFE0F', highlighted: false }]);
});

test('the character next to a range of them is left alone', () => {
    for (const text of ['\u2065', '\u{E0002}', '\u{E0080}']) {
        expect(partsOf(getLogLineParts(text))).toEqual([{ text, highlighted: false }]);
    }
});

test('a highlight over a bidi control stays a highlight on both of its sides', () => {
    expect(partsOf(getLogLineParts('a\u202Eb', { ranges: [{ start: 0, end: 3 }] }))).toEqual([
        { text: 'a', highlighted: true },
        { text: '\u202E', highlighted: true, control: 'U+202E' },
        { text: 'b', highlighted: true },
    ]);
});

test('a line full of bidi controls can’t make a span of each, and none of them reaches the screen raw', () => {
    const { chunks } = getLogLineParts('x\u202E'.repeat(50_000), { whole: true });
    const parts = chunks.flat();

    expect(parts.filter(part => part.control !== undefined).length).toBeLessThan(200);
    for (const part of parts) {
        if (part.control === undefined) {
            expect(part.text).not.toContain('\u202E');
        }
    }
});

function partsOf({ chunks }: LogLineParts) {
    return chunks.flat();
}
