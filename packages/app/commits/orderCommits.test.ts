/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleCommit, sampleHistory } from '@/testing/sampleCommits.js';

import type { KeptCommit } from './CommitTypes.js';
import { orderCommits } from './orderCommits.js';

test('newest committer date first across unrelated branches (git log --date-order)', () => {
    const commits = [
        sampleCommit('base', 0),
        sampleCommit('main1', 10, ['base']),
        sampleCommit('feat1', 20, ['base']),
        sampleCommit('main2', 30, ['main1']),
        sampleCommit('feat2', 40, ['feat1']),
    ];

    expect(oids(orderCommits(commits))).toEqual(['feat2', 'main2', 'feat1', 'main1', 'base']);
});

test('clock skew: a child dated before its parent still goes above it', () => {
    const commits = [
        sampleCommit('parent', 100),
        // Committed on a machine whose clock was behind.
        sampleCommit('child', 50, ['parent']),
        sampleCommit('grandchild', 60, ['child']),
        sampleCommit('other', 80),
    ];

    const ordered = oids(orderCommits(commits));

    expect(ordered).toEqual(['other', 'grandchild', 'child', 'parent']);
    expectParentsBelowChildren(orderCommits(commits));
});

test('clock skew under a merge: a parent dated after the merge stays below it', () => {
    const commits = [
        sampleCommit('base', 0),
        sampleCommit('main', 10, ['base']),
        sampleCommit('feature', 500, ['base']),
        sampleCommit('merge', 100, ['main', 'feature']),
    ];

    expect(oids(orderCommits(commits))).toEqual(['merge', 'feature', 'main', 'base']);
});

test('the same committer date is ordered by oid, whatever the input order', () => {
    const commits = [sampleCommit('c', 10), sampleCommit('a', 10), sampleCommit('b', 10)];

    expect(oids(orderCommits(commits))).toEqual(['a', 'b', 'c']);
    expect(oids(orderCommits(commits.toReversed()))).toEqual(['a', 'b', 'c']);
});

test('parents that are not loaded are ignored', () => {
    const commits = [sampleCommit('tip', 20, ['middle', 'unloaded']), sampleCommit('middle', 10, ['also-unloaded'])];

    expect(oids(orderCommits(commits))).toEqual(['tip', 'middle']);
});

test('a large random history: every commit once, parents below children, the newest ready commit next', () => {
    const commits = sampleHistory({ count: 2000, seed: 7, skew: true });

    const ordered = orderCommits(commits.toReversed());

    expect(ordered).toHaveLength(commits.length);
    expect(new Set(oids(ordered)).size).toBe(commits.length);
    expectParentsBelowChildren(ordered);
    expectNewestReadyFirst(ordered);
    expect(oids(orderCommits(commits))).toEqual(oids(ordered));
});

function oids(commits: readonly KeptCommit[]) {
    return commits.map(commit => commit.oid);
}

function expectParentsBelowChildren(ordered: readonly KeptCommit[]) {
    const index = new Map(ordered.map((commit, i) => [commit.oid, i]));
    for (const [i, commit] of ordered.entries()) {
        for (const parent of commit.parents) {
            const parentIndex = index.get(parent.oid);
            if (parentIndex !== undefined) {
                expect(parentIndex).toBeGreaterThan(i);
            }
        }
    }
}

/** Replays the order: each commit must be the newest (then lowest oid) of those whose children are all placed. */
function expectNewestReadyFirst(ordered: readonly KeptCommit[]) {
    const loaded = new Set(oids(ordered));
    const unplacedChildren = new Map<string, number>();
    for (const commit of ordered) {
        for (const parent of new Set(commit.parents.map(p => p.oid))) {
            if (loaded.has(parent)) {
                unplacedChildren.set(parent, (unplacedChildren.get(parent) ?? 0) + 1);
            }
        }
    }
    const placed = new Set<string>();
    for (const commit of ordered) {
        let best: KeptCommit | null = null;
        for (const candidate of ordered) {
            if (
                !placed.has(candidate.oid) &&
                !unplacedChildren.get(candidate.oid) &&
                (!best || isBefore(candidate, best))
            ) {
                best = candidate;
            }
        }
        expect(commit.oid).toBe(best?.oid ?? '');
        placed.add(commit.oid);
        for (const parent of new Set(commit.parents.map(p => p.oid))) {
            const left = unplacedChildren.get(parent);
            if (left !== undefined) {
                unplacedChildren.set(parent, left - 1);
            }
        }
    }
}

function isBefore(a: KeptCommit, b: KeptCommit) {
    const timeA = Date.parse(a.committedDate);
    const timeB = Date.parse(b.committedDate);
    return timeA !== timeB ? timeA > timeB : a.oid < b.oid;
}
