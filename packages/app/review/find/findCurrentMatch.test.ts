import { expect, test } from 'bun:test';

import { buildFileLineRows, buildReviewRows } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import type { DiffLayout } from '../diff/buildDiffRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import { collectFindLines } from './collectFindLines.js';
import { compileFindQuery } from './compileFindQuery.js';
import { findCurrentMatch, getMatchIdentity } from './findCurrentMatch.js';
import type { FindCurrentMatchFrom, FindMatchIdentity } from './findCurrentMatch.js';
import { findDiffMatches } from './findDiffMatches.js';

const A: ReviewFile = {
    path: 'src/a.ts',
    previousPath: null,
    changeType: 'MODIFIED',
    additions: 3,
    deletions: 2,
    viewed: 'UNVIEWED',
};
const BEFORE = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
// Two lines changed, so split pairs each removed line with its replacement and unified lists both removed lines first.
const AFTER = BEFORE.replace('line 20\nline 21\n', 'needle 20\nneedle 21\n');
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace: false });
const REMOVED_21: FindMatchIdentity = { path: A.path, side: 'before', line: 21, start: 5 };

test('a new result of the same query stays on the same match across a layout switch, not on the same place', () => {
    const split = search('split', '2');
    const unified = search('unified', '2');
    const inSplit = findCurrent('split', '2', { kind: 'kept', identity: REMOVED_21 });

    const inUnified = findCurrent('unified', '2', { kind: 'kept', identity: REMOVED_21 });

    expect(inSplit).not.toBe(inUnified);
    expect(inSplit === null ? null : getMatchIdentity(split.lines, split.matches, inSplit)).toEqual(REMOVED_21);
    expect(inUnified === null ? null : getMatchIdentity(unified.lines, unified.matches, inUnified)).toEqual(REMOVED_21);
});

test('a match gone from the result gives way to the first one after it, wrapping past the last', () => {
    const { lines, matches } = search('unified', '2');
    const identityAt = (position: number | null) =>
        position === null ? null : getMatchIdentity(lines, matches, position);

    const after = findCurrent('unified', '2', {
        kind: 'kept',
        identity: { path: A.path, side: 'after', line: 22, start: 7 },
    });
    const past = findCurrent('unified', '2', { kind: 'kept', identity: { ...REMOVED_21, line: 99 } });

    expect(identityAt(after)).toEqual({ path: A.path, side: 'after', line: 23, start: 5 });
    expect(past).toBe(0);
});

test("a new query lands on the first counted match from the cursor's row, wrapping past the last", () => {
    const rows = rowsOf('split');
    const { lines, matches } = search('split', '2');
    const at = (cursorKey: string | null) => {
        const position = findCurrentMatch({ lines, matches, rows, from: { kind: 'cursor', cursorKey } });
        return position === null ? null : getMatchIdentity(lines, matches, position);
    };
    const row22 = rows.find(row => row.kind === 'line' && row.line.layout === 'split' && row.line.right?.line === 22);

    // The left half of an unchanged row matches too, but isn't counted: the newer side is landed on.
    expect(at(row22?.key ?? null)).toEqual({ path: A.path, side: 'after', line: 22, start: 5 });
    expect(at(rows.at(-1)?.key ?? null)).toEqual({ path: A.path, side: 'before', line: 20, start: 5 });
    expect(at(null)).toEqual({ path: A.path, side: 'before', line: 20, start: 5 });
});

test('no counted match, nothing to land on', () => {
    const { lines, matches } = search('split', 'nothing like it');

    expect(
        findCurrentMatch({ lines, matches, rows: rowsOf('split'), from: { kind: 'cursor', cursorKey: null } }),
    ).toBeNull();
});

function findCurrent(layout: DiffLayout, query: string, from: FindCurrentMatchFrom) {
    return findCurrentMatch({ ...search(layout, query), rows: rowsOf(layout), from });
}

function search(layout: DiffLayout, query: string) {
    const lines = collectFindLines(rowsOf(layout));
    const expression = compileFindQuery(query, { matchCase: false, wholeWord: false, regex: false });
    if (!(expression instanceof RegExp)) {
        throw new TypeError(`Not a query: ${query}`);
    }

    return { lines, matches: findDiffMatches(lines, expression) };
}

function rowsOf(layout: DiffLayout): ReviewRow[] {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout }) }),
    });
}
