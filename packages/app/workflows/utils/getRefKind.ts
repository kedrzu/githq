import type { RefKind, RepositoryWorkflows } from '../WorkflowTypes.js';

/**
 * Whether a ref a run named is a tag or a branch, by the repository's tags as last read: a run names only its ref. A
 * ref named like a tag is a tag; before the tags are read, or once a tag is deleted, a branch.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRefKind(stored: RepositoryWorkflows, refName: string): RefKind {
    return stored.tags.includes(refName) ? 'tag' : 'branch';
}
