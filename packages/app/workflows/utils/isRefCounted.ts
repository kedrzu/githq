import type { WorkflowRefSettings } from '../WorkflowTypes.js';
import { matchRefPattern } from './matchRefPattern.js';

/**
 * Whether a ref's runs count under a repository's settings (actions D5, D13): it is the default branch while that is
 * on, or a pattern matches it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isRefCounted(settings: WorkflowRefSettings, defaultBranch: string | null, ref: string): boolean {
    return (
        (settings.defaultBranch && ref === defaultBranch) ||
        settings.refs.some(pattern => matchRefPattern(pattern, ref))
    );
}
