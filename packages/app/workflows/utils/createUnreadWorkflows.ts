import type { RepositoryWorkflows } from '../WorkflowTypes.js';

/**
 * What is kept of a repository's workflows before anything was read of them — `unread`, neither healthy nor counted.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function createUnreadWorkflows(nameWithOwner: string): RepositoryWorkflows {
    return {
        nameWithOwner,
        defaultBranch: null,
        repositoryEtag: null,
        runsEtag: null,
        workflowsEtag: null,
        workflows: [],
        readAt: null,
        unavailable: null,
    };
}
