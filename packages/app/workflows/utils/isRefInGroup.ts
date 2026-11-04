import type { WorkflowRefGroup } from '../WorkflowTypes.js';
import { matchRefPattern } from './matchRefPattern.js';

/**
 * Whether a ref belongs to a group (actions D1, D5, D13): it is the group's default branch, or its pattern matches it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRefInGroup(ref: string, group: WorkflowRefGroup): boolean {
    return group.kind === 'defaultBranch' ? ref === group.branch : matchRefPattern(group.pattern, ref);
}
