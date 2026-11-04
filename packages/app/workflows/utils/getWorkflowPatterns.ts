import type { WorkflowRefSettings } from '../WorkflowTypes.js';

/**
 * A repository's patterns, each once, in the user's order. Deduped here and not when the settings are read: a reader
 * dropping a duplicate would clean the settings file on the next write.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowPatterns(settings: WorkflowRefSettings): string[] {
    return [...new Set(settings.refs)];
}
