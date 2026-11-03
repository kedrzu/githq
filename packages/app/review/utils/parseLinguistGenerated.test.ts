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
