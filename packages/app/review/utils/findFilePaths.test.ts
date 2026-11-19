import { expect, test } from 'bun:test';

import { findFilePaths } from './findFilePaths.js';
import type { FoundFilePath } from './findFilePaths.js';

const PATHS = [
    'packages/app/review/ReviewView.vue',
    'packages/app/review/ReviewFileList.vue',
    'packages/app/review/ReviewFileRow.vue',
    'packages/app/commands/CommandMenu.vue',
    'README.md',
];

test('scattered letters of a name find that file first, marked in its name', () => {
    const found = findFilePaths('rvwfl', PATHS);

    const expected: FoundFilePath = {
        path: 'packages/app/review/ReviewFileList.vue',
        part: 'name',
        ranges: [0, 1, 2, 3, 5, 7, 8, 9],
    };
    expect(found[0]).toEqual(expected);
    expect(found.map(({ path }) => path)).not.toContain('packages/app/commands/CommandMenu.vue');
});

test('a match in the name outranks the same match in a folder alone', () => {
    const paths = ['src/sync/index.ts', 'src/sync/engine.ts', 'docs/sync.md'];

    const found = findFilePaths('sync', paths);

    const expected: FoundFilePath[] = [
        { path: 'docs/sync.md', part: 'name', ranges: [0, 4] },
        // Equals keep the list's order.
        { path: 'src/sync/index.ts', part: 'folder', ranges: [4, 8] },
        { path: 'src/sync/engine.ts', part: 'folder', ranges: [4, 8] },
    ];
    expect(found).toEqual(expected);
});

test('a folder typed as it is outranks letters scattered in a name', () => {
    const found = findFilePaths('src', ['lib/ScreenReader.ts', 'src/index.ts']);

    expect(found.map(({ path }) => path)).toEqual(['src/index.ts', 'lib/ScreenReader.ts']);
});

test('a match across the folder and the name marks nothing', () => {
    const found = findFilePaths('app/rfl', ['packages/app/review/ReviewFileList.vue']);

    const expected: FoundFilePath[] = [{ path: 'packages/app/review/ReviewFileList.vue', part: null, ranges: null }];
    expect(found).toEqual(expected);
});

test('nothing typed lists every path in order, unmarked', () => {
    expect(findFilePaths(' ', PATHS)).toEqual(PATHS.map(path => ({ path, part: null, ranges: null })));
});
