/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleCommit, sampleHistory } from '@/testing/sampleCommits.js';

import type { KeptCommit } from './CommitTypes.js';
import type { CommitGraphLayout, CommitGraphLineHalf, CommitGraphRow } from './layoutCommitGraph.js';
import { layoutCommitGraph } from './layoutCommitGraph.js';
import { orderCommits } from './orderCommits.js';

test('a linear history stays in one lane, every row joined to the next', () => {
    const { ordered, layout } = lay([sampleCommit('a', 0), sampleCommit('b', 10, ['a']), sampleCommit('c', 20, ['b'])]);

    expect(layout.rows).toEqual([
        { oid: 'c', column: 0, isMerge: false, lines: [{ half: 'bottom', lane: 0 }] },
        {
            oid: 'b',
            column: 0,
            isMerge: false,
            lines: [
                { half: 'top', lane: 0 },
                { half: 'bottom', lane: 0 },
            ],
        },
        { oid: 'a', column: 0, isMerge: false, lines: [{ half: 'top', lane: 0 }] },
    ]);
    expect(layout.maxWidth).toBe(1);
    expectConsistentLayout(ordered, layout);
});

test('a feature branch merged back: the second parent edge leaves the merge into its own lane and reaches the branch', () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('main1', 10, ['base']),
        sampleCommit('feat1', 20, ['base']),
        sampleCommit('feat2', 30, ['feat1']),
        sampleCommit('merge', 40, ['main1', 'feat2']),
        sampleCommit('after', 50, ['merge']),
    ]);

    expect(ordered.map(c => c.oid)).toEqual(['after', 'merge', 'feat2', 'feat1', 'main1', 'base']);
    expect(summarize(layout.rows)).toEqual([
        'after @0: bottom0',
        'merge @0 merge: top0 bottom0 bottom1',
        'feat2 @1: full0 top1 bottom1',
        'feat1 @1: full0 top1 bottom1',
        'main1 @0: top0 bottom0 full1',
        'base @0: top0 top1',
    ]);
    expect(layout.maxWidth).toBe(2);
    expect(traceEdges(layout, 'merge')).toEqual(['main1', 'feat2']);
    expectConsistentLayout(ordered, layout);
});

test('two branches off one commit: the branch-off point collects the edges of both', () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('left', 10, ['base']),
        sampleCommit('right', 20, ['base']),
    ]);

    expect(summarize(layout.rows)).toEqual(['right @0: bottom0', 'left @1: full0 bottom1', 'base @0: top0 top1']);
    expect(traceEdges(layout, 'left')).toEqual(['base']);
    expect(traceEdges(layout, 'right')).toEqual(['base']);
    expectConsistentLayout(ordered, layout);
});

test('an octopus merge sends an edge to each of its three parents', () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('p1', 10, ['base']),
        sampleCommit('p2', 20, ['base']),
        sampleCommit('p3', 30, ['base']),
        sampleCommit('octopus', 40, ['p1', 'p2', 'p3']),
    ]);

    expect(layout.rows[0]).toMatchObject({ oid: 'octopus', column: 0, isMerge: true });
    expect(traceEdges(layout, 'octopus').toSorted()).toEqual(['p1', 'p2', 'p3']);
    expect(rowOf(layout, 'base').lines.filter(line => line.half === 'top')).toHaveLength(3);
    expect(layout.maxWidth).toBe(3);
    expectConsistentLayout(ordered, layout);
});

test('clock skew: a child dated before its parent is still drawn above it and joined to it', () => {
    const { ordered, layout } = lay([
        sampleCommit('parent', 100),
        sampleCommit('child', 50, ['parent']),
        sampleCommit('other', 80, ['parent']),
    ]);

    expect(ordered.map(c => c.oid)).toEqual(['other', 'child', 'parent']);
    expect(traceEdges(layout, 'child')).toEqual(['parent']);
    expectConsistentLayout(ordered, layout);
});

test('a parent that is not loaded keeps its lane running to the bottom of the last row', () => {
    const { ordered, layout } = lay([
        sampleCommit('old', 0, ['unloaded-first']),
        sampleCommit('merge', 10, ['old', 'unloaded-second']),
        sampleCommit('tip', 20, ['merge']),
    ]);

    expect(summarize(layout.rows)).toEqual([
        'tip @0: bottom0',
        'merge @0 merge: top0 bottom0 bottom1',
        'old @0: top0 bottom0 full1',
    ]);
    expect(traceEdges(layout, 'merge')).toEqual(['old', null]);
    expect(traceEdges(layout, 'old')).toEqual([null]);
    expectConsistentLayout(ordered, layout);
});

test('several unrelated tips whose histories join later: each takes a lane and they merge where they meet', () => {
    const { ordered, layout } = lay([
        sampleCommit('root', 0),
        sampleCommit('a1', 10, ['root']),
        sampleCommit('b1', 20, ['root']),
        sampleCommit('c1', 30, ['a1']),
        sampleCommit('a2', 40, ['a1']),
        sampleCommit('b2', 50, ['b1']),
        sampleCommit('c2', 60, ['c1']),
    ]);

    expect(summarize(layout.rows)).toEqual([
        'c2 @0: bottom0',
        'b2 @1: full0 bottom1',
        'a2 @2: full0 full1 bottom2',
        'c1 @0: top0 bottom0 full1 full2',
        'b1 @1: full0 top1 bottom1 full2',
        'a1 @0: top0 bottom0 full1 top2',
        'root @0: top0 top1',
    ]);
    expectConsistentLayout(ordered, layout);
});

test('a criss-cross merge: each merge reaches both bases', () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('a', 10, ['base']),
        sampleCommit('b', 20, ['base']),
        sampleCommit('x', 30, ['a', 'b']),
        sampleCommit('y', 40, ['b', 'a']),
    ]);

    expect(traceEdges(layout, 'x').toSorted()).toEqual(['a', 'b']);
    expect(traceEdges(layout, 'y').toSorted()).toEqual(['a', 'b']);
    expect(rowOf(layout, 'x').isMerge).toBe(true);
    expect(rowOf(layout, 'y').isMerge).toBe(true);
    expectConsistentLayout(ordered, layout);
});

test('a lane freed by a merged branch is reused instead of widening the graph, without moving the others', () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('f1', 10, ['base']),
        sampleCommit('m1', 20, ['base', 'f1']),
        sampleCommit('g1', 30, ['m1']),
        sampleCommit('m2', 40, ['m1', 'g1']),
    ]);

    expect(summarize(layout.rows)).toEqual([
        'm2 @0 merge: bottom0 bottom1',
        'g1 @1: full0 top1 bottom1',
        'm1 @0 merge: top0 bottom0 top1 bottom1',
        'f1 @1: full0 top1 bottom1',
        'base @0: top0 top1',
    ]);
    expect(layout.maxWidth).toBe(2);
    expectConsistentLayout(ordered, layout);
});

test("a merge's second parent joins the lane already waiting for it instead of opening another", () => {
    const { ordered, layout } = lay([
        sampleCommit('base', 0),
        sampleCommit('main', 10, ['base']),
        sampleCommit('shared', 20, ['base']),
        sampleCommit('merge', 40, ['main', 'shared']),
        sampleCommit('topic', 50, ['shared']),
    ]);

    expect(summarize(layout.rows)).toEqual([
        'topic @0: bottom0',
        'merge @1 merge: full0 bottom0 bottom1',
        'shared @0: top0 bottom0 full1',
        'main @1: full0 top1 bottom1',
        'base @0: top0 top1',
    ]);
    expect(layout.maxWidth).toBe(2);
    expectConsistentLayout(ordered, layout);
});

test('a lane never moves:a branch right of a freed lane stays where it is', () => {
    const { ordered, layout } = lay([
        sampleCommit('root', 0),
        sampleCommit('mid', 10, ['root']),
        sampleCommit('far', 20, ['root']),
        sampleCommit('near', 30, ['mid']),
        sampleCommit('tip', 40, ['mid']),
    ]);

    expect(summarize(layout.rows)).toEqual([
        'tip @0: bottom0',
        'near @1: full0 bottom1',
        'far @2: full0 full1 bottom2',
        'mid @0: top0 bottom0 top1 full2',
        'root @0: top0 top2',
    ]);
    expectConsistentLayout(ordered, layout);
});

test('large random histories keep every lane continuous and every edge leading to its parent', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
        const { ordered, layout } = lay(sampleHistory({ count: 1500, seed, skew: seed % 2 === 0 }));

        expectConsistentLayout(ordered, layout);
    }
});

test('the default branch runs in the first lane, under newer branches that go past it', () => {
    const commits = orderCommits([
        sampleCommit('f2', 50, ['f1']),
        sampleCommit('g1', 45, ['m2']),
        sampleCommit('f1', 40, ['m1']),
        sampleCommit('m2', 30, ['m1']),
        sampleCommit('m1', 20, ['m0']),
        sampleCommit('m0', 10),
    ]);
    const layout = layoutCommitGraph(commits, 'm2');

    expectConsistentLayout(commits, layout, 'm2');
    const column = (oid: string) => layout.rows.find(row => row.oid === oid)?.column;
    expect(column('f2')).toBe(1);
    expect(column('g1')).toBe(2);
    expect(column('m2')).toBe(0);
    expect(column('m1')).toBe(0);
    expect(column('m0')).toBe(0);
    // Nothing is drawn in the first lane above its tip.
    expect(layout.rows[0]?.lines.some(line => line.lane === 0)).toBe(false);
    expect(layout.hasMainLane).toBe(true);
});

test('a default branch whose tip is not among the commits keeps nothing free', () => {
    const commits = orderCommits([sampleCommit('a', 20, ['b']), sampleCommit('b', 10)]);
    expect(layoutCommitGraph(commits, 'gone').rows.map(row => row.column)).toEqual([0, 0]);
    expect(layoutCommitGraph(commits, 'gone').hasMainLane).toBe(false);
});

test('no commits, no rows', () => {
    expect(layoutCommitGraph([])).toEqual({ rows: [], maxWidth: 0, hasMainLane: false });
});

function lay(commits: readonly KeptCommit[]) {
    const ordered = orderCommits(commits);
    return { ordered, layout: layoutCommitGraph(ordered) };
}

function rowOf(layout: CommitGraphLayout, oid: string): CommitGraphRow {
    const row = layout.rows.find(r => r.oid === oid);
    if (!row) {
        throw new Error(`No row for ${oid}`);
    }
    return row;
}

/** One line per row: `oid @column [merge]: lines`, lines sorted by lane, then top, full, bottom. */
function summarize(rows: readonly CommitGraphRow[]) {
    const halfOrder: Record<CommitGraphLineHalf, number> = { top: 0, full: 1, bottom: 2 };
    return rows.map(row => {
        const lines = row.lines
            .toSorted((a, b) => a.lane - b.lane || halfOrder[a.half] - halfOrder[b.half])
            .map(line => `${line.half}${line.lane}`);
        return `${row.oid} @${row.column}${row.isMerge ? ' merge' : ''}: ${lines.join(' ')}`;
    });
}

/**
 * Follows each `bottom` line of the commit's row down through `full` lines until it enters a row at the top: the oid
 * of that row, or `null` when it runs past the last row. In the order of the row's lines.
 */
function traceEdges(layout: CommitGraphLayout, oid: string): (string | null)[] {
    const start = layout.rows.findIndex(row => row.oid === oid);
    const startRow = layout.rows[start];
    if (!startRow) {
        throw new Error(`No row for ${oid}`);
    }

    const ends: (string | null)[] = [];
    for (const line of startRow.lines) {
        if (line.half !== 'bottom') {
            continue;
        }
        let end: string | null = null;
        for (const row of layout.rows.slice(start + 1)) {
            if (hasLine(row, 'top', line.lane)) {
                end = row.oid;
                break;
            }
            expect(hasLine(row, 'full', line.lane)).toBe(true);
        }
        ends.push(end);
    }
    return ends;
}

/**
 * The invariants any layout must keep:
 * - one row per commit, in order, `isMerge` for more than one parent;
 * - `maxWidth` is one more than the highest lane among the dots and lines;
 * - nothing enters the first row from above;
 * - lanes are continuous: the lanes leaving a row's bottom (`bottom`, `full`) are exactly those entering the next
 *   row's top (`top`, `full`), so a lane open after the last row is one that runs off the graph;
 * - each commit's dot is reached at its column when anything enters it, and has no line both entering and passing;
 * - each `bottom` line leads, through `full` lines, to the top of the row of one of the commit's parents, one per
 *   distinct parent; a parent that isn't loaded is the one edge allowed to run past the last row.
 */
function expectConsistentLayout(ordered: readonly KeptCommit[], layout: CommitGraphLayout, mainTip?: string) {
    expect(layout.rows.map(row => row.oid)).toEqual(ordered.map(commit => commit.oid));
    const loaded = new Set(ordered.map(commit => commit.oid));

    let maxWidth = 0;
    let openBelow = new Set<number>();
    for (const [i, row] of layout.rows.entries()) {
        const commit = ordered[i];
        if (!commit) {
            throw new Error(`No commit for row ${i}`);
        }
        expect(row.isMerge).toBe(commit.parents.length > 1);
        expect(row.column).toBeGreaterThanOrEqual(0);
        maxWidth = Math.max(maxWidth, row.column + 1, ...row.lines.map(line => line.lane + 1));

        const enteringTop = lanesWith(row, ['top', 'full']);
        expect([...enteringTop].toSorted()).toEqual([...openBelow].toSorted());

        const tops = lanesWith(row, ['top']);
        const fulls = lanesWith(row, ['full']);
        for (const lane of tops) {
            expect(fulls.has(lane)).toBe(false);
        }
        // The default branch's tip takes the first lane, whichever lanes its children come down in.
        if (tops.size > 0 && row.oid !== mainTip) {
            expect(tops.has(row.column)).toBe(true);
        }
        expect(row.lines).toHaveLength(new Set(row.lines.map(line => `${line.half}${line.lane}`)).size);

        const parents = [...new Set(commit.parents.map(parent => parent.oid))];
        const expectedEnds = parents.map(parent => (loaded.has(parent) ? parent : null));
        expect(sortEnds(traceEdges(layout, row.oid))).toEqual(sortEnds(expectedEnds));
        if (parents.length > 0) {
            expect(hasLine(row, 'bottom', row.column)).toBe(true);
        }

        openBelow = lanesWith(row, ['bottom', 'full']);
    }
    expect(layout.maxWidth).toBe(maxWidth);
}

function lanesWith(row: CommitGraphRow, halves: readonly CommitGraphLineHalf[]) {
    return new Set(row.lines.filter(line => halves.includes(line.half)).map(line => line.lane));
}

function hasLine(row: CommitGraphRow, half: CommitGraphLineHalf, lane: number) {
    return row.lines.some(line => line.half === half && line.lane === lane);
}

function sortEnds(ends: readonly (string | null)[]) {
    return ends.map(end => end ?? '').toSorted();
}
