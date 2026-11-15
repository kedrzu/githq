import type { CommitRowRef } from './CommitRow.vue';
import type { KeptCommitRefs } from './CommitTypes.js';

/**
 * The branches and tags pointing at each commit, by its oid: the default branch first, then branches, then tags — as a
 * row of the graph and a commit's details show them. Empty until the refs are read.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function groupCommitRefs(refs: KeptCommitRefs | null): Map<string, CommitRowRef[]> {
    const byOid = new Map<string, CommitRowRef[]>();
    if (!refs) {
        return byOid;
    }

    const all: [oid: string, ref: CommitRowRef][] = [
        ...refs.branches
            .filter(branch => branch.name === refs.defaultBranch)
            .map((branch): [string, CommitRowRef] => [branch.oid, { name: branch.name, kind: 'default' }]),
        ...refs.branches
            .filter(branch => branch.name !== refs.defaultBranch)
            .map((branch): [string, CommitRowRef] => [branch.oid, { name: branch.name, kind: 'branch' }]),
        ...refs.tags.map((tag): [string, CommitRowRef] => [tag.oid, { name: tag.name, kind: 'tag' }]),
    ];
    for (const [oid, ref] of all) {
        const atCommit = byOid.get(oid);
        if (atCommit) {
            atCommit.push(ref);
        } else {
            byOid.set(oid, [ref]);
        }
    }

    return byOid;
}
