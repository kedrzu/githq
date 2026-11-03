import { expect, test } from 'bun:test';

import { parseLinguistGenerated } from './parseLinguistGenerated.js';

test.each([
    ['*.gen.ts linguist-generated', 'src/api/client.gen.ts', true],
    ['*.gen.ts linguist-generated', 'src/api/client.ts', false],
    ['*.gen.ts linguist-generated=true', 'client.gen.ts', true],
    ['dist/** linguist-generated', 'dist/a/b.js', true],
    ['dist/** linguist-generated', 'src/dist/b.js', false],
    ['/dist/*.js linguist-generated', 'dist/b.js', true],
    ['/dist/*.js linguist-generated', 'dist/a/b.js', false],
    ['src/api/*.json linguist-generated', 'src/api/a.json', true],
    ['**/gen/*.ts linguist-generated', 'gen/a.ts', true],
    ['**/gen/*.ts linguist-generated', 'x/y/gen/a.ts', true],
    ['a/**/b.ts linguist-generated', 'a/b.ts', true],
    ['a/**/b.ts linguist-generated', 'a/x/y/b.ts', true],
    ['generated/ linguist-generated', 'generated/a.ts', true],
    ['generated/ linguist-generated', 'src/generated/x/a.ts', true],
    ['generated/ linguist-generated', 'src/generated', false],
    ['src/generated/ linguist-generated', 'other/src/generated/a.ts', false],
    ['schema.json linguist-generated', 'deep/schema.json', true],
    ['*.[ch] linguist-generated', 'a.c', true],
    ['*.[ch] linguist-generated', 'a.d', false],
    ['file?.ts linguist-generated', 'file1.ts', true],
    ['"with space.ts" linguist-generated', 'with space.ts', true],
    ['*.ts text eol=lf', 'a.ts', false],
    ['# *.ts linguist-generated', 'a.ts', false],
    ['*.ts -linguist-generated', 'a.ts', false],
    ['*.ts linguist-generated=false', 'a.ts', false],
])('%s on %s: %p', (line, path, expected) => {
    expect(parseLinguistGenerated(line)(path)).toBe(expected);
});

test('later lines win, either way', () => {
    const isGenerated = parseLinguistGenerated(
        [
            '# comment',
            '',
            'dist/** linguist-generated',
            'dist/keep.js -linguist-generated',
            '*.min.js linguist-generated=true',
        ].join('\n'),
    );

    expect(isGenerated('dist/a.js')).toBe(true);
    expect(isGenerated('dist/keep.js')).toBe(false);
    expect(isGenerated('dist/keep.min.js')).toBe(true);
    expect(isGenerated('src/a.ts')).toBe(false);
});

test('a pattern written to take a tab down answers at once', () => {
    const line = `${'*a'.repeat(40)}b linguist-generated`;

    expect(parseLinguistGenerated(line)('a'.repeat(4000))).toBe(false);
});

test('a line of 2048 bytes or more says nothing, as for git, counted in bytes; shorter ones around it do', () => {
    const shortest = (filler: string, bytes: number) =>
        `${filler.repeat(bytes - ' linguist-generated'.length)} linguist-generated`;
    const isGenerated = parseLinguistGenerated(
        [
            shortest('x', 2047),
            shortest('y', 2048),
            `${'é'.repeat(1015)} linguist-generated`,
            '*.gen.ts linguist-generated',
        ].join('\n'),
    );

    expect(isGenerated('x'.repeat(2047 - ' linguist-generated'.length))).toBe(true);
    expect(isGenerated('y'.repeat(2048 - ' linguist-generated'.length))).toBe(false);
    expect(isGenerated('é'.repeat(1015))).toBe(false);
    expect(isGenerated('a.gen.ts')).toBe(true);
});

test('over 16 KiB of rules for this attribute the file marks nothing generated', () => {
    const rule = '*.gen.ts linguist-generated';
    const within = Math.floor((16 * 1024) / rule.length);

    expect(parseLinguistGenerated(Array.from({ length: within }, () => rule).join('\n'))('a.gen.ts')).toBe(true);
    expect(parseLinguistGenerated(Array.from({ length: within + 1 }, () => rule).join('\n'))('a.gen.ts')).toBe(false);
});

test('rules of other attributes, however many, cost nothing of it', () => {
    const lfs = Array.from({ length: 5000 }, (_, index) => `assets/${index}.bin filter=lfs diff=lfs merge=lfs -text`);

    expect(parseLinguistGenerated([...lfs, '*.gen.ts linguist-generated'].join('\n'))('a.gen.ts')).toBe(true);
});

test('a tree and rules made to cost too much stop being matched, in well under a second', () => {
    const isGenerated = parseLinguistGenerated(Array.from({ length: 780 }, () => 'z/ linguist-generated').join('\n'));
    const deep = `${'a/'.repeat(2047)}z/file.ts`;

    const start = performance.now();
    const answers = Array.from({ length: 3000 }, () => isGenerated(deep));
    const elapsed = performance.now() - start;

    expect(answers[0]).toBe(true);
    expect(answers.at(-1)).toBe(false);
    expect(elapsed).toBeLessThan(3000);
});
