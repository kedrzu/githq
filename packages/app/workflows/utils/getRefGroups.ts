import type { WorkflowRefGroup, WorkflowRefSettings } from '../WorkflowTypes.js';
import { getWorkflowPatterns } from './getWorkflowPatterns.js';

/**
 * The groups a repository's runs are judged in (actions D1, D5): its default branch while it counts and is known,
 * then each pattern once, in the user's order. None when the settings count nothing: the repository lights nothing.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRefGroups(settings: WorkflowRefSettings, defaultBranch: string | null): WorkflowRefGroup[] {
    const groups: WorkflowRefGroup[] = [];
    if (settings.defaultBranch && defaultBranch !== null) {
        groups.push({ kind: 'defaultBranch', branch: defaultBranch });
    }

    for (const pattern of getWorkflowPatterns(settings)) {
        groups.push({ kind: 'pattern', pattern });
    }

    return groups;
}
