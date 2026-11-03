import type { KeptCommit } from './CommitTypes.js';

interface ReadyCommit {
    readonly commit: KeptCommit;
    readonly time: number;
}

/**
 * Orders loaded commits the way `git log --date-order` does (git-client D9): newest committer date first, but never a
 * parent above any of its children, even when the dates disagree (a child dated before its parent). Kahn's algorithm
 * over the edges between loaded commits, taking the newest ready commit next (ties by oid, so the order is stable);
 * a parent that isn't loaded is ignored.
 * @__NO_SIDE_EFFECTS__
 */
export function orderCommits(commits: readonly KeptCommit[]): KeptCommit[] {
    const byOid = new Map(commits.map(commit => [commit.oid, commit]));

    // How many loaded children of each commit are not placed yet.
    const unplacedChildren = new Map<string, number>();
    for (const commit of byOid.values()) {
        for (const parentOid of loadedParentOids(commit, byOid)) {
            unplacedChildren.set(parentOid, (unplacedChildren.get(parentOid) ?? 0) + 1);
        }
    }

    const ready: ReadyCommit[] = [];
    for (const commit of byOid.values()) {
        if (!unplacedChildren.has(commit.oid)) {
            pushReady(ready, toReady(commit));
        }
    }

    const ordered: KeptCommit[] = [];
    let next = popReady(ready);
    while (next) {
        ordered.push(next.commit);
        for (const parentOid of loadedParentOids(next.commit, byOid)) {
            const left = (unplacedChildren.get(parentOid) ?? 0) - 1;
            unplacedChildren.set(parentOid, left);
            const parent = byOid.get(parentOid);
            if (left === 0 && parent) {
                pushReady(ready, toReady(parent));
            }
        }
        next = popReady(ready);
    }

    return ordered;
}

/** The commit's distinct parents that are loaded — an edge counted twice would never be released. */
function loadedParentOids(commit: KeptCommit, byOid: ReadonlyMap<string, KeptCommit>): Set<string> {
    const oids = new Set<string>();
    for (const parent of commit.parents) {
        if (byOid.has(parent.oid)) {
            oids.add(parent.oid);
        }
    }
    return oids;
}

function toReady(commit: KeptCommit): ReadyCommit {
    return { commit, time: Date.parse(commit.committedDate) };
}

/** Whether `a` goes before `b`: the newer one, or the lower oid when they were committed at the same time. */
function isBefore(a: ReadyCommit, b: ReadyCommit): boolean {
    if (a.time !== b.time) {
        return a.time > b.time;
    }
    return a.commit.oid < b.commit.oid;
}

// A binary heap kept in an array, `isBefore` first.

function pushReady(heap: ReadyCommit[], item: ReadyCommit) {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
        const parentIndex = (index - 1) >> 1;
        const parent = heap[parentIndex];
        if (!parent || !isBefore(item, parent)) {
            break;
        }
        heap[index] = parent;
        index = parentIndex;
    }
    heap[index] = item;
}

function popReady(heap: ReadyCommit[]): ReadyCommit | undefined {
    const top = heap[0];
    const last = heap.pop();
    if (top === undefined || last === undefined || heap.length === 0) {
        return top;
    }

    let index = 0;
    for (;;) {
        const leftIndex = index * 2 + 1;
        const rightIndex = leftIndex + 1;
        const left = heap[leftIndex];
        const right = heap[rightIndex];
        let childIndex = leftIndex;
        let child = left;
        if (right && left && isBefore(right, left)) {
            childIndex = rightIndex;
            child = right;
        }
        if (!child || !isBefore(child, last)) {
            break;
        }
        heap[index] = child;
        index = childIndex;
    }
    heap[index] = last;
    return top;
}
