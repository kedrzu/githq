/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getNewestEdits } from './getNewestEdits.js';
import type { SegmentEdits } from './SegmentEdits.js';

const FAILED: SegmentEdits = { kind: 'failed', text: 'Merge refused · acme/web#2' };
const UNANSWERED: SegmentEdits = { kind: 'unanswered', text: "acme/web#15 · GitHub hasn't answered" };

test('PM36: the newest says it — a merge unanswered after an older failure, and a failure after an older unanswered merge', () => {
    expect(
        getNewestEdits([
            { edits: UNANSWERED, at: 2000 },
            { edits: FAILED, at: 1000 },
        ]),
    ).toBe(UNANSWERED);
    expect(
        getNewestEdits([
            { edits: UNANSWERED, at: 1000 },
            { edits: FAILED, at: 2000 },
        ]),
    ).toBe(FAILED);
});

test('either alone says it; the first given on a tie; nothing to say without any', () => {
    expect(getNewestEdits([null, { edits: FAILED, at: 1000 }])).toBe(FAILED);
    expect(getNewestEdits([{ edits: UNANSWERED, at: 1000 }, null])).toBe(UNANSWERED);
    expect(
        getNewestEdits([
            { edits: UNANSWERED, at: 1000 },
            { edits: FAILED, at: 1000 },
        ]),
    ).toBe(UNANSWERED);
    expect(getNewestEdits([null, null])).toBeNull();
});
