import type { WorkflowRefSettings } from '../WorkflowTypes.js';
import { getRefGroups } from './getRefGroups.js';
import { isRefInGroup } from './isRefInGroup.js';

/** What {@link isRefCounted} decides from. */
export interface IsRefCountedParams {
    readonly settings: WorkflowRefSettings;
    /** The branch GitHub calls the default one; `null` before the first read. */
    readonly defaultBranch: string | null;
    readonly ref: string;
}

/**
 * Whether a ref's runs count under a repository's settings (actions D5, D13): it is the default branch while that is
 * on, or a pattern matches it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRefCounted(params: IsRefCountedParams): boolean {
    const { settings, defaultBranch, ref } = params;
    return getRefGroups(settings, defaultBranch).some(group => isRefInGroup(ref, group));
}
