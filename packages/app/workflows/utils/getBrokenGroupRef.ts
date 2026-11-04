import type { WorkflowGroupState, WorkflowRowRef } from '../WorkflowTypes.js';

/**
 * What a row names of the group a workflow is broken in: the default branch's name, or the pattern, with the kind of
 * the ref its latest failed run there is on — a branch when that is unknown.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getBrokenGroupRef({ group, failedRef }: WorkflowGroupState): WorkflowRowRef {
    return {
        name: group.kind === 'defaultBranch' ? group.branch : group.pattern,
        kind: failedRef?.kind ?? 'branch',
    };
}
