import { expect, test } from 'bun:test';

import type { LineMark } from '../find/RowMarks.js';

import type { LineSpan } from './getLineSpans.js';
import { markLineSpans } from './markLineSpans.js';
import type { MarkedLineSpans } from './markLineSpans.js';

/** `const total = count + 1;`, its keyword, its name and its constant coloured. */
const SPANS: readonly LineSpan[] = [
    { text: 'const', kind: 'keyword' },
    { text: ' ', kind: null },
    { text: 'total', kind: 'title' },
    { text: ' = count + ', kind: null },
    { text: '1', kind: 'constant' },
    { text: ';', kind: null },
];

test('without marks, the spans as they are', () => {
    const expected: MarkedLineSpans[] = [{ mark: null, spans: SPANS }];
    expect(markLineSpans(SPANS, [])).toEqual(expected);
});

test('a mark across tokens is one mark, the tokens it starts and ends in split, each piece keeping its kind', () => {
    // "st total = c": from inside `const` to inside the plain text after `total`.
    const marks: LineMark[] = [{ start: 3, end: 15, current: false }];

    const stretches = markLineSpans(SPANS, marks);

    const expected: MarkedLineSpans[] = [
        { mark: null, spans: [{ text: 'con', kind: 'keyword' }] },
        {
            mark: 'match',
            spans: [
                { text: 'st', kind: 'keyword' },
                { text: ' ', kind: null },
                { text: 'total', kind: 'title' },
                { text: ' = c', kind: null },
            ],
        },
        {
            mark: null,
            spans: [
                { text: 'ount + ', kind: null },
                { text: '1', kind: 'constant' },
                { text: ';', kind: null },
            ],
        },
    ];
    expect(stretches).toEqual(expected);
    expect(getText(stretches)).toBe(getText([{ mark: null, spans: SPANS }]));
});

test('the current match is told apart; two matches next to each other stay two marks; an empty one marks nothing', () => {
    const marks: LineMark[] = [
        { start: 0, end: 2, current: false },
        { start: 2, end: 5, current: true },
        { start: 7, end: 7, current: false },
        { start: 23, end: 24, current: false },
    ];

    const expected: MarkedLineSpans[] = [
        { mark: 'match', spans: [{ text: 'co', kind: 'keyword' }] },
        { mark: 'current', spans: [{ text: 'nst', kind: 'keyword' }] },
        {
            mark: null,
            spans: [
                { text: ' ', kind: null },
                { text: 'total', kind: 'title' },
                { text: ' = count + ', kind: null },
                { text: '1', kind: 'constant' },
            ],
        },
        { mark: 'match', spans: [{ text: ';', kind: null }] },
    ];
    expect(markLineSpans(SPANS, marks)).toEqual(expected);
});

function getText(stretches: readonly MarkedLineSpans[]) {
    return stretches.flatMap(stretch => stretch.spans.map(span => span.text)).join('');
}
