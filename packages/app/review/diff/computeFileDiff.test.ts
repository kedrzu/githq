/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { diff as diffAllLines } from 'fast-myers-diff';

import { rngMulberry32 } from '@nzyme/crypto';

import { computeFileDiff } from './computeFileDiff.js';

const exact = { ignoreWhitespace: false };
const ignoring = { ignoreWhitespace: true };
const ONLY_BEFORE = ['gone', 'gone too', 'gone as well'];
const ONLY_AFTER = ['new', 'new too', 'new as well'];

test('a final line without a newline is kept; a trailing newline makes no extra line, and blank lines stay', () => {
    expect(computeFileDiff({ before: 'a\nb', after: null, ...exact }).before).toEqual(['a', 'b']);
    expect(computeFileDiff({ before: 'a\nb\n', after: null, ...exact }).before).toEqual(['a', 'b']);
    expect(computeFileDiff({ before: '\n', after: null, ...exact }).before).toEqual(['']);
    expect(computeFileDiff({ before: 'a\n\n', after: null, ...exact }).before).toEqual(['a', '']);
});

test('the change blocks are the changed ranges in both versions', () => {
    const diff = computeFileDiff({ before: 'a\nb\nc\nd\ne\nf\n', after: 'a\nB\nc\nd\nf\nnew\n', ...exact });

    expect(diff.after).toEqual(['a', 'B', 'c', 'd', 'f', 'new']);
    expect(diff.blocks).toEqual([
        { beforeStart: 1, beforeEnd: 2, afterStart: 1, afterEnd: 2 },
        { beforeStart: 4, beforeEnd: 5, afterStart: 4, afterEnd: 4 },
        { beforeStart: 6, beforeEnd: 6, afterStart: 5, afterEnd: 6 },
    ]);
});

test('with whitespace hidden, a line differing only in whitespace is no change and keeps its real text', () => {
    const before = 'if (a) {\n  call( b );\n}\n';
    const after = 'if (a) {\n\tcall(b);\n}\n';

    expect(computeFileDiff({ before, after, ...exact }).blocks).toHaveLength(1);

    const diff = computeFileDiff({ before, after, ...ignoring });
    expect(diff.blocks).toEqual([]);
    expect(diff.before[1]).toBe('  call( b );');
    expect(diff.after[1]).toBe('\tcall(b);');
});

test('with whitespace hidden, a real change next to a whitespace change is still a change', () => {
    const diff = computeFileDiff({ before: '  one\ntwo\nthree\n', after: 'one\nTWO\nthree\n', ...ignoring });

    expect(diff.blocks).toEqual([{ beforeStart: 1, beforeEnd: 2, afterStart: 1, afterEnd: 2 }]);
});

test('an added file is all added, a deleted file all deleted', () => {
    expect(computeFileDiff({ before: null, after: 'a\nb', ...exact })).toMatchObject({
        before: [],
        after: ['a', 'b'],
        blocks: [{ beforeStart: 0, beforeEnd: 0, afterStart: 0, afterEnd: 2 }],
    });
    expect(computeFileDiff({ before: 'a\nb\n', after: null, ...exact })).toMatchObject({
        before: ['a', 'b'],
        after: [],
        blocks: [{ beforeStart: 0, beforeEnd: 2, afterStart: 0, afterEnd: 0 }],
    });
});

test('empty files have no lines and no change', () => {
    for (const [before, after] of [
        [null, null],
        ['', ''],
        ['', null],
        [null, ''],
    ] as const) {
        expect(computeFileDiff({ before, after, ...exact })).toMatchObject({ before: [], after: [], blocks: [] });
    }
});

test('an added final newline is no change', () => {
    expect(computeFileDiff({ before: 'a\nb', after: 'a\nb\n', ...exact }).blocks).toEqual([]);
});

test('CRLF on both sides is no change and shows in no line', () => {
    const diff = computeFileDiff({ before: 'a\r\nb\r\n', after: 'a\r\nb\r\n', ...exact });

    expect(diff).toMatchObject({ before: ['a', 'b'], after: ['a', 'b'], blocks: [] });
});

test('CRLF on both sides diffs the lines that changed', () => {
    const diff = computeFileDiff({ before: 'a\r\nb\r\nc\r\n', after: 'a\r\nB\r\nc\r\n', ...exact });

    expect(diff.after).toEqual(['a', 'B', 'c']);
    expect(diff.blocks).toEqual([{ beforeStart: 1, beforeEnd: 2, afterStart: 1, afterEnd: 2 }]);
});

test('line endings converted to LF are a change of every line, unless whitespace is hidden', () => {
    expect(computeFileDiff({ before: 'a\r\nb\r\n', after: 'a\nb\n', ...exact }).blocks).toEqual([
        { beforeStart: 0, beforeEnd: 2, afterStart: 0, afterEnd: 2 },
    ]);
    expect(computeFileDiff({ before: 'a\r\nb\r\n', after: 'a\nb\n', ...ignoring }).blocks).toEqual([]);
});

test('on random files, the lines between the blocks correspond, and the blocks never touch', () => {
    const random = rngMulberry32(1);
    for (let round = 0; round < 500; round++) {
        const options = { ignoreWhitespace: round % 2 === 0 };
        const before = randomLines(random, ONLY_BEFORE);
        const after = randomLines(random, ONLY_AFTER);
        const diff = computeFileDiff({ before: before.join('\n'), after: after.join('\n'), ...options });
        const compared = (line: string) => (options.ignoreWhitespace ? line.replace(/\s/g, '') : line);

        let beforeAt = 0;
        let afterAt = 0;
        for (const [index, block] of diff.blocks.entries()) {
            expect(diff.before.slice(beforeAt, block.beforeStart).map(compared)).toEqual(
                diff.after.slice(afterAt, block.afterStart).map(compared),
            );
            // Touching blocks would break the pairing of deleted and added lines in a split row.
            expect(index === 0 || block.beforeStart > beforeAt).toBe(true);
            beforeAt = block.beforeEnd;
            afterAt = block.afterEnd;
        }

        expect(diff.before.slice(beforeAt).map(compared)).toEqual(diff.after.slice(afterAt).map(compared));
    }
});

test('on random files, leaving out the lines only one side has changes as few lines as diffing them all', () => {
    const random = rngMulberry32(2);
    for (let round = 0; round < 500; round++) {
        const { before, after, blocks } = computeFileDiff({
            before: randomLines(random, ONLY_BEFORE).join('\n'),
            after: randomLines(random, ONLY_AFTER).join('\n'),
            ...exact,
        });

        let changedInAll = 0;
        for (const [beforeStart, beforeEnd, afterStart, afterEnd] of diffAllLines(before, after)) {
            changedInAll += beforeEnd - beforeStart + afterEnd - afterStart;
        }

        const changed = blocks.reduce(
            (sum, block) => sum + block.beforeEnd - block.beforeStart + block.afterEnd - block.afterStart,
            0,
        );
        expect(changed).toBe(changedInAll);
    }
});

test('a large file rewritten but for one line is one block on each side of that line', () => {
    const rewritten = (tag: string) =>
        Array.from({ length: 25_000 }, (_, line) => (line === 12_500 ? 'kept' : `${tag} ${line}`)).join('\n');

    expect(computeFileDiff({ before: rewritten('old'), after: rewritten('new'), ...exact }).blocks).toEqual([
        { beforeStart: 0, beforeEnd: 12_500, afterStart: 0, afterEnd: 12_500 },
        { beforeStart: 12_501, beforeEnd: 25_000, afterStart: 12_501, afterEnd: 25_000 },
    ]);
});

/**
 * Lines that often repeat and differ only in whitespace, plus those given, none blank, so that joining them gives back
 * exactly these lines.
 */
function randomLines(random: () => number, own: readonly string[]): string[] {
    const variants = ['a', ' a', 'a ', 'b', '\tb', 'c d', 'cd', ...own];
    return Array.from(
        { length: Math.floor(random() * 30) },
        () => variants[Math.floor(random() * variants.length)] ?? 'a',
    );
}
