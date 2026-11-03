import { describe, expect, test } from 'bun:test';

import { createFileFilter } from './createFileFilter.js';

const PATHS = [
    'README.md',
    'docs/logo.png',
    'docs/images/deep/hero.png',
    'docs/guide.md',
    'public/banner.png',
    'public/banner.pngx',
    'src/sync/engine.ts',
    'src/sync/engine.test.ts',
    'src/docs/note.ts',
    '.github/workflows/e2e.yml',
];

function matching(pattern: string, regex = false) {
    const filter = createFileFilter({ pattern, regex });
    if (filter.kind !== 'on') {
        throw new Error(`"${pattern}" is ${filter.kind}`);
    }

    return PATHS.filter(path => filter.matches(path));
}

describe('a pattern (D11)', () => {
    test.each(['*.png', '.png'])('%s means the extension, in any folder and not a longer one', pattern => {
        expect(matching(pattern)).toEqual(['docs/logo.png', 'docs/images/deep/hero.png', 'public/banner.png']);
    });

    test('docs/**/*.png means a folder and an extension, at any depth under it, right in it too', () => {
        expect(matching('docs/**/*.png')).toEqual(['docs/logo.png', 'docs/images/deep/hero.png']);
    });

    test('plain text is found anywhere in a path, whatever the case', () => {
        expect(matching('ENGINE')).toEqual(['src/sync/engine.ts', 'src/sync/engine.test.ts']);
        expect(matching('sync/eng')).toEqual(['src/sync/engine.ts', 'src/sync/engine.test.ts']);
    });

    test('a star stays within a name, and ** crosses folders', () => {
        expect(matching('src/*.ts')).toEqual([]);
        expect(matching('src/**.ts')).toEqual(['src/sync/engine.ts', 'src/sync/engine.test.ts', 'src/docs/note.ts']);
        expect(matching('**/*.test.*')).toEqual(['src/sync/engine.test.ts']);
    });

    test('a glob is typed from any folder, as in VS Code, unless it starts at the root', () => {
        expect(matching('docs/**')).toEqual([
            'docs/logo.png',
            'docs/images/deep/hero.png',
            'docs/guide.md',
            'src/docs/note.ts',
        ]);
        expect(matching('/docs/*.md')).toEqual(['docs/guide.md']);
        expect(matching('./docs/*.md')).toEqual(['docs/guide.md']);
    });

    test.each([
        ['docs/*.png', 'mydocs/x.png'],
        ['test*.ts', 'src/mytest1.ts'],
        ['src/**/a.ts', 'src/b/xa.ts'],
        ['**/a.ts', 'src/xa.ts'],
        ['a/**/b', 'a/xb'],
    ])('%s does not start in the middle of a name: %s', (pattern, path) => {
        const filter = createFileFilter({ pattern, regex: false });
        expect(filter.kind === 'on' && filter.matches(path)).toBe(false);
    });

    test.each([
        ['docs/*.png', 'docs/x.png'],
        ['docs/*.png', 'a/docs/x.png'],
        ['test*.ts', 'src/test1.ts'],
        ['src/**/a.ts', 'src/a.ts'],
        ['src/**/a.ts', 'src/b/c/a.ts'],
        ['a/**/b', 'a/b'],
        ['*.ts', 'a.ts'],
        ['src/*a.ts', 'src/xa.ts'],
        ['src/**a.ts', 'src/b/xa.ts'],
    ])('%s still matches %s', (pattern, path) => {
        const filter = createFileFilter({ pattern, regex: false });
        expect(filter.kind === 'on' && filter.matches(path)).toBe(true);
    });

    test('? is one character of a name', () => {
        expect(matching('docs/lo?o.png')).toEqual(['docs/logo.png']);
        expect(matching('docs?logo.png')).toEqual([]);
    });

    test('a leading dot with no extension to end on still finds the folder', () => {
        expect(matching('.github')).toEqual(['.github/workflows/e2e.yml']);
    });

    test('parts apart by commas each match', () => {
        expect(matching('*.md, public/**')).toEqual([
            'README.md',
            'docs/guide.md',
            'public/banner.png',
            'public/banner.pngx',
        ]);
    });

    test('nothing typed, or only commas and spaces, filters nothing', () => {
        for (const pattern of ['', '   ', ' , ,']) {
            expect(createFileFilter({ pattern, regex: false }).kind).toBe('off');
        }

        expect(createFileFilter({ pattern: '  ', regex: true }).kind).toBe('off');
    });

    test('a glob made to backtrack answers at once', () => {
        const pattern = `${'*a'.repeat(40)}*b`;
        const filter = createFileFilter({ pattern, regex: false });
        const started = performance.now();

        expect(filter.kind === 'on' && filter.matches(`${'a'.repeat(4000)}c`)).toBe(false);
        expect(performance.now() - started).toBeLessThan(200);
    });
});

test('given paths, those files exactly, whatever the pattern says: not one holding one of them, one with a comma included', () => {
    const paths = ['a.ts', 'docs/x, y.md'];
    const filter = createFileFilter({ pattern: paths.join(', '), regex: false, paths });

    if (filter.kind !== 'on') {
        throw new Error(filter.kind);
    }

    expect(['a.ts', 'data.ts', 'docs/x, y.md', 'docs/x', 'y.md'].filter(filter.matches)).toEqual([
        'a.ts',
        'docs/x, y.md',
    ]);
});

describe('a regular expression (D11)', () => {
    test('is matched against the whole path', () => {
        expect(matching('^src/(sync|docs)/.*\\.ts$', true)).toEqual([
            'src/sync/engine.ts',
            'src/sync/engine.test.ts',
            'src/docs/note.ts',
        ]);
    });

    test('takes commas and stars as its own', () => {
        expect(matching('png{1,2}$', true)).toEqual([
            'docs/logo.png',
            'docs/images/deep/hero.png',
            'public/banner.png',
        ]);
    });

    test('that is invalid does not throw, and says so', () => {
        expect(createFileFilter({ pattern: '(unclosed', regex: true })).toEqual({ kind: 'invalid' });
    });

    test('the same text as a pattern is not invalid', () => {
        expect(createFileFilter({ pattern: '(unclosed', regex: false }).kind).toBe('on');
    });
});
