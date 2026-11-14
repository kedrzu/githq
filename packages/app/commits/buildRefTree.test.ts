/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { assertNever } from '@nzyme/utils/assertNever.js';

import type { CommitRef } from './CommitTypes.js';
import { buildRefTree, flattenRefTree } from './buildRefTree.js';
import type { FlattenRefTreeOptions, RefTreeFolder, RefTreeRow } from './buildRefTree.js';

test('a prefix held by one ref makes no folder: the ref stays loose under its full name', () => {
    const tree = buildRefTree([sampleRef('kedrzu/fix-x', 1), sampleRef('develop', 2)], 'branches');

    expect(draw(tree)).toEqual(['develop', 'kedrzu/fix-x']);
});

test('folders nest at every level, a lone prefix inside one staying loose', () => {
    const tree = buildRefTree(
        [sampleRef('release/2026/q4', 4), sampleRef('release/2026/q3', 3), sampleRef('release/1.0', 1)],
        'tags',
    );

    expect(draw(tree, { isUnfolded: () => true })).toEqual([
        'v release (3) tags:release',
        '  v 2026 (2) tags:release/2026',
        '    q4',
        '    q3',
        '  1.0',
    ]);
});

test('a ref and a folder of the same name both stay', () => {
    const tree = buildRefTree(
        [sampleRef('feature', 1), sampleRef('feature/a', 2), sampleRef('feature/b', 3)],
        'branches',
    );

    expect(draw(tree, { isUnfolded: () => true })).toEqual(['v feature (2) branches:feature', '  b', '  a', 'feature']);
});

test('every ref is in the tree exactly once', () => {
    const refs = [
        sampleRef('main', 1),
        sampleRef('feature', 2),
        sampleRef('feature/a', 3),
        sampleRef('feature/b/c', 4),
        sampleRef('feature/b/d', 5),
        sampleRef('feature/e/f', 6),
        sampleRef('kedrzu/x/y/z', 7),
    ];

    const found = collectRefs(buildRefTree(refs, 'branches'));

    expect(found.toSorted(byName)).toEqual(refs.toSorted(byName));
});

test('a folded folder hides its refs and still counts all of them, at every level', () => {
    const tree = buildRefTree(
        [
            sampleRef('release/2026/q4', 4),
            sampleRef('release/2026/q3', 3),
            sampleRef('release/1.0', 1),
            sampleRef('main', 9),
        ],
        'tags',
    );

    expect(draw(tree)).toEqual(['> release (3) tags:release', 'main']);
    expect(draw(tree, { isUnfolded: path => path === 'tags:release/2026' })).toEqual([
        '> release (3) tags:release',
        'main',
    ]);
    expect(draw(tree, { isUnfolded: path => path === 'tags:release' })).toEqual([
        'v release (3) tags:release',
        '  > 2026 (2) tags:release/2026',
        '  1.0',
        'main',
    ]);
});

test('each level draws its own share, folders and refs counted together, the rest behind its "more" row', () => {
    const refs = [
        sampleRef('a/1', 100),
        sampleRef('a/2', 99),
        sampleRef('b/1', 98),
        sampleRef('b/2', 97),
        ...Array.from({ length: 25 }, (_, index) => sampleRef(`testing/v${index + 1}`, index + 1)),
        sampleRef('loose', 0),
    ];
    const tree = buildRefTree(refs, 'tags');
    const shown = new Map([['tags:', 2]]);

    const rows = flattenRefTree(tree, {
        ...DEFAULTS,
        isUnfolded: path => path === 'tags:testing' || path === 'tags:a',
        shownAt: path => shown.get(path) ?? 20,
    });

    // `a` and `b` are the newest folders: only they fit the root's two, with `a` unfolded; `testing` and `loose` hidden.
    expect(rows.map(describe)).toEqual(['v a (2) tags:a', '  1', '  2', '> b (2) tags:b', '+2 more of tags: at 0']);

    shown.set('tags:', 20);
    shown.set('tags:testing', 40);
    const all = flattenRefTree(tree, {
        ...DEFAULTS,
        isUnfolded: path => path === 'tags:testing',
        shownAt: path => shown.get(path) ?? 20,
    });
    expect(all.filter(row => row.kind === 'ref' && row.depth === 1)).toHaveLength(25);
    expect(all.some(row => row.kind === 'more')).toBe(false);

    shown.set('tags:testing', 20);
    const cut = flattenRefTree(tree, {
        ...DEFAULTS,
        isUnfolded: path => path === 'tags:testing',
        shownAt: path => shown.get(path) ?? 20,
    });
    const more: RefTreeRow = { kind: 'more', path: 'tags:testing', hidden: 5, depth: 1 };
    expect(cut.filter(row => row.kind === 'more')).toEqual([more]);
});

test('newest first: folders by their newest ref, refs by date, ties by name, folders before refs', () => {
    const tree = buildRefTree(
        [
            sampleRef('old/1', 1),
            sampleRef('old/2', 50),
            sampleRef('new/1', 60),
            sampleRef('new/2', 2),
            sampleRef('zeta', 90),
            sampleRef('beta', 10),
            sampleRef('alpha', 10),
        ],
        'branches',
    );

    expect(draw(tree, { isUnfolded: () => true })).toEqual([
        'v new (2) branches:new',
        '  1',
        '  2',
        'v old (2) branches:old',
        '  2',
        '  1',
        'zeta',
        'alpha',
        'beta',
    ]);
});

test('by name: natural numeric order at every level, folders before refs', () => {
    const tree = buildRefTree(
        [
            sampleRef('v100', 1),
            sampleRef('v99', 2),
            sampleRef('hld-100', 3),
            sampleRef('hld-9', 4),
            sampleRef('hld-98', 5),
            sampleRef('rel/10/a', 6),
            sampleRef('rel/10/b', 7),
            sampleRef('rel/9/a', 8),
            sampleRef('rel/9/b', 9),
            sampleRef('rel/2', 10),
            sampleRef('zz/a', 11),
            sampleRef('zz/b', 12),
        ],
        'branches',
    );

    expect(draw(tree, { order: 'name', isUnfolded: () => true })).toEqual([
        'v rel (5) branches:rel',
        '  v 9 (2) branches:rel/9',
        '    a',
        '    b',
        '  v 10 (2) branches:rel/10',
        '    a',
        '    b',
        '  2',
        'v zz (2) branches:zz',
        '  a',
        '  b',
        'hld-9',
        'hld-98',
        'hld-100',
        'v99',
        'v100',
    ]);
});

test('filtering shows only the matches and the folders holding them, unfolded, counting matches, with full names', () => {
    const refs = [
        sampleRef('testing/v12', 5),
        sampleRef('testing/v120', 4),
        sampleRef('testing/v3', 3),
        sampleRef('release/2026/q4', 2),
        sampleRef('release/2026/v12-hotfix', 6),
        sampleRef('release/1.0', 1),
        sampleRef('other/a', 7),
        sampleRef('other/b', 8),
        sampleRef('v12', 0),
        sampleRef('main', 9),
    ];
    const tree = buildRefTree(refs, 'tags');
    const matches = new Set(refs.filter(ref => ref.name.includes('v12')));

    expect(draw(tree, { matches, isUnfolded: () => false })).toEqual([
        'v release (1) tags:release',
        '  v 2026 (1) tags:release/2026',
        '    release/2026/v12-hotfix',
        'v testing (2) tags:testing',
        '  testing/v12',
        '  testing/v120',
        'v12',
    ]);
});

test('filtering still cuts each level to its share', () => {
    const refs = Array.from({ length: 30 }, (_, index) => sampleRef(`testing/v${index}`, index));
    const tree = buildRefTree(refs, 'tags');

    const rows = flattenRefTree(tree, { ...DEFAULTS, matches: new Set(refs.slice(0, 25)) });

    const more: RefTreeRow = { kind: 'more', path: 'tags:testing', hidden: 5, depth: 1 };
    expect(rows[0]).toEqual({
        kind: 'folder',
        path: 'tags:testing',
        name: 'testing',
        count: 25,
        unfolded: true,
        depth: 0,
    });
    expect(rows.filter(row => row.kind === 'ref')).toHaveLength(20);
    expect(rows.at(-1)).toEqual(more);
});

test('5,000 tags: each level draws its share, and shown in full every tag is one row', () => {
    const refs = [
        ...Array.from({ length: 3000 }, (_, index) => sampleRef(`testing/v${index}`, index)),
        ...Array.from({ length: 1000 }, (_, index) => sampleRef(`release/${index % 10}/r${index}`, index)),
        ...Array.from({ length: 1000 }, (_, index) => sampleRef(`v${index}`, index)),
    ];
    const tree = buildRefTree(refs, 'tags');

    const folded = flattenRefTree(tree, { ...DEFAULTS, isUnfolded: path => path === 'tags:testing' });
    // Root: 2 folders and 18 of 1,000 loose tags, then its "more"; `testing` unfolded: 20 tags and its "more".
    expect(folded).toHaveLength(1 + 20 + 1 + 1 + 18 + 1);
    expect(folded.flatMap(row => (row.kind === 'more' ? [row.hidden] : []))).toEqual([2980, 982]);

    const full = flattenRefTree(tree, { ...DEFAULTS, isUnfolded: () => true, shownAt: () => Infinity });
    const shownRefs = full.flatMap(row => (row.kind === 'ref' ? [row.ref] : []));
    expect(shownRefs).toHaveLength(5000);
    expect(new Set(shownRefs).size).toBe(5000);
    // Folders: `testing`, `release` and its ten `0`…`9`.
    expect(full.filter(row => row.kind === 'folder')).toHaveLength(12);
});

const DEFAULTS: FlattenRefTreeOptions = { isUnfolded: () => false, shownAt: () => 20, order: 'newest' };

/** A ref committed `minutes` after an arbitrary moment. */
function sampleRef(name: string, minutes: number): CommitRef {
    return {
        name,
        oid: name,
        commitId: `C_${name}`,
        committedDate: new Date(Date.UTC(2026, 0, 1) + minutes * 60_000).toISOString(),
    };
}

function draw(tree: RefTreeFolder, options: Partial<FlattenRefTreeOptions> = {}): string[] {
    return flattenRefTree(tree, { ...DEFAULTS, ...options }).map(describe);
}

function describe(row: RefTreeRow): string {
    const indent = '  '.repeat(row.depth);
    switch (row.kind) {
        case 'folder':
            return `${indent}${row.unfolded ? 'v' : '>'} ${row.name} (${row.count}) ${row.path}`;
        case 'ref':
            return `${indent}${row.label}`;
        case 'more':
            return `${indent}+${row.hidden} more of ${row.path} at ${row.depth}`;
        default:
            return assertNever(row);
    }
}

function collectRefs(folder: RefTreeFolder): CommitRef[] {
    return [...folder.refs.map(leaf => leaf.ref), ...folder.folders.flatMap(collectRefs)];
}

function byName(a: CommitRef, b: CommitRef): number {
    return a.name < b.name ? -1 : 1;
}
