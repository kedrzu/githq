import { expect, test } from 'bun:test';

import type { Freshness } from '@/sync/Freshness.js';

import { getReviewHeaderKey } from '../buildReviewRows.js';
import type { ReviewFile } from '../ReviewFiles.js';
import { getLandingFreshness } from './getLandingFreshness.js';

const FILES: readonly ReviewFile[] = [
    { path: 'a.ts', previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'VIEWED' },
    { path: 'b.ts', previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'DISMISSED' },
    { path: 'c.ts', previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'UNVIEWED' },
];

test('a first visit counts what is viewed of all the pull request has, more than listed so far, and says what a walk came from', () => {
    const plain = getLandingFreshness({
        arrival: { kind: 'firstFile' },
        number: 1203,
        files: FILES,
        changedFiles: 42,
        walkedBy: null,
    });
    const expected: Freshness = {
        kind: 'landing',
        at: 'firstFile',
        number: 1203,
        viewed: 1,
        total: 42,
        backTo: null,
    };
    expect(plain).toEqual(expected);

    const walked = getLandingFreshness({
        arrival: { kind: 'firstFile' },
        number: 1203,
        files: FILES,
        changedFiles: 42,
        walkedBy: { to: 'acme/web/1203', from: 1202, back: 'K' },
    });
    expect(walked).toEqual({ ...expected, backTo: { key: 'K', number: 1202 } });
});

test('coming back names the file, and the line only for a place that is one', () => {
    const common = { number: 1202, files: FILES, changedFiles: 42, walkedBy: null };
    expect(
        getLandingFreshness({
            ...common,
            arrival: { kind: 'left', place: { kind: 'line', path: 'src/engine.ts', side: 'after', line: 47 } },
        }),
    ).toEqual({ kind: 'landing', at: 'left', number: 1202, file: 'engine.ts', line: 47 });
    expect(
        getLandingFreshness({
            ...common,
            arrival: { kind: 'left', place: { kind: 'row', key: getReviewHeaderKey('src/engine.ts') } },
        }),
    ).toEqual({ kind: 'landing', at: 'left', number: 1202, file: 'engine.ts', line: null });
});
