/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { parseDiffHunk } from './parseDiffHunk.js';

test('lines are numbered from the hunk header, added on the new side, deleted on the old, without their signs', () => {
    const lines = parseDiffHunk(
        '@@ -212,2 +212 @@ export interface WorkoutPatch {\n title?: string\n-notes?: string\n+note?: string\r\n\\ No newline at end of file',
    );

    expect(lines).toEqual([
        { oldLine: 212, newLine: 212, sign: ' ', text: 'title?: string' },
        { oldLine: 213, newLine: null, sign: '-', text: 'notes?: string' },
        { oldLine: null, newLine: 213, sign: '+', text: 'note?: string' },
    ]);
});

test("a hunk without a header has no lines, as a FILE thread's empty one", () => {
    expect(parseDiffHunk('')).toEqual([]);
    expect(parseDiffHunk('not a hunk\n+x')).toEqual([]);
});
