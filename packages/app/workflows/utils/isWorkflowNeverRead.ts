import type { StoredWorkflow } from '../WorkflowTypes.js';

/**
 * Whether an active workflow's runs were never read: no run of it is known, nor that it has none. Its row says
 * "Reading…", and nothing about it may look healthy or count as known.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isWorkflowNeverRead(entry: StoredWorkflow): boolean {
    return entry.workflow.state === 'active' && entry.runs.length === 0 && Object.keys(entry.etags).length === 0;
}
