import { expect, mock, test } from 'bun:test';

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

// Each checked against `git check-attr linguist-generated`.
test.each([
    ['[attr]gen linguist-generated\n*.ts gen', 'a.ts', true],
    ['*.ts gen\n[attr]gen linguist-generated', 'a.ts', true],
    ['[attr]gen linguist-generated\n[attr]outer other gen\n*.ts outer', 'a.ts', true],
    ['[attr]gen linguist-generated\n[attr]gen -linguist-generated\n*.ts gen', 'a.ts', false],
    ['[attr]gen -linguist-generated\n* linguist-generated\n*.ts gen', 'a.ts', false],
    ['[attr]gen linguist-generated\n*.css -gen', 'a.css', false],
    ['[attr]gen linguist-generated\n*.css !gen', 'a.css', false],
    ['[attr]gen linguist-generated\n*.css gen=x', 'a.css', false],
    ['[attr]gen linguist-generated\n*.ts gen -gen', 'a.ts', false],
    ['[attr]gen linguist-generated\n*.ts -gen gen', 'a.ts', true],
    ['[attr]gen linguist-generated\n*.ts gen -linguist-generated', 'a.ts', false],
    ['[attr]gen linguist-generated\n*.ts -linguist-generated gen', 'a.ts', true],
    ['[attr]a b\n[attr]b a\n*.ts a', 'a.ts', false],
    ['[attr]a b\n[attr]b a linguist-generated\n*.ts a', 'a.ts', true],
])('macros, as for git: %j on %s: %p', (text, path, expected) => {
    expect(parseLinguistGenerated(text)(path)).toBe(expected);
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
    const onGaveUp = mock();
    const tooMany = Array.from({ length: within + 1 }, () => rule).join('\n');
    expect(parseLinguistGenerated(tooMany, onGaveUp)('a.gen.ts')).toBe(false);
    expect(onGaveUp).toHaveBeenCalledTimes(1);
});

test('rules of other attributes, however many, cost nothing of it', () => {
    const lfs = Array.from({ length: 5000 }, (_, index) => `assets/${index}.bin filter=lfs diff=lfs merge=lfs -text`);

    expect(parseLinguistGenerated([...lfs, '*.gen.ts linguist-generated'].join('\n'))('a.gen.ts')).toBe(true);
});

test('macros cost nothing of it either, nor lines using one that says nothing of this attribute; one that does is a rule', () => {
    const macros = Array.from({ length: 2000 }, (_, index) => `[attr]other${index} filter=lfs -text`);
    const uses = Array.from({ length: 2000 }, (_, index) => `assets/${index}.bin other${index}`);
    const text = [...macros, ...uses, '[attr]gen linguist-generated', '*.gen.ts gen'].join('\n');

    expect(parseLinguistGenerated(text)('a.gen.ts')).toBe(true);

    const rules = Array.from({ length: Math.ceil((16 * 1024) / '*.gen.ts gen'.length) + 1 }, () => '*.gen.ts gen');
    expect(parseLinguistGenerated(['[attr]gen linguist-generated', ...rules].join('\n'))('a.gen.ts')).toBe(false);
});

test('a tree and rules made to cost too much stop being matched, in well under a second', () => {
    const onGaveUp = mock();
    const isGenerated = parseLinguistGenerated(
        Array.from({ length: 780 }, () => 'z/ linguist-generated').join('\n'),
        onGaveUp,
    );
    const deep = `${'a/'.repeat(2047)}z/file.ts`;

    const start = performance.now();
    const answers = Array.from({ length: 3000 }, () => isGenerated(deep));
    const elapsed = performance.now() - start;

    expect(answers[0]).toBe(true);
    expect(answers.at(-1)).toBe(false);
    expect(elapsed).toBeLessThan(3000);
    expect(onGaveUp).toHaveBeenCalledTimes(1);
});

test.each([
    ['stars', Array.from({ length: 222 }, () => `*${'a'.repeat(50)}b`), 'a'.repeat(253)],
    ['a long class', Array.from({ length: 7 }, () => `*[${'b'.repeat(2000)}]c`), 'a'.repeat(253)],
    ['what follows the name', Array.from({ length: 7 }, () => `a${'*'.repeat(2000)}b/`), `${'a/'.repeat(2047)}f`],
])('rules made to cost too much on shallow paths, by %s, give up quickly on what is left', (_, patterns, path) => {
    const onGaveUp = mock();
    const isGenerated = parseLinguistGenerated(
        patterns.map(pattern => `${pattern} linguist-generated`).join('\n'),
        onGaveUp,
    );

    const start = performance.now();
    for (let index = 0; index < 3000; index++) {
        isGenerated(path);
    }

    expect(performance.now() - start).toBeLessThan(3000);
    expect(onGaveUp).toHaveBeenCalledTimes(1);
});

test('16 KB of ordinary rules still match every one of 3,000 files, eight folders deep', () => {
    const rules: string[] = [];
    for (let bytes = 0, index = 0; bytes < 16 * 1024 - 60; index++) {
        const rule = `*.gen${index}.ts linguist-generated`;
        rules.push(rule);
        bytes += rule.length;
    }

    const onGaveUp = mock();
    const isGenerated = parseLinguistGenerated([...rules, '**/*.client.ts linguist-generated'].join('\n'), onGaveUp);
    const paths = Array.from({ length: 3000 }, (_, index) => `a/b/c/d/e/f/g/file${index}.client.ts`);

    expect(paths.filter(path => isGenerated(path))).toEqual(paths);
    expect(onGaveUp).not.toHaveBeenCalled();
});
