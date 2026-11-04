import type { RepositoryWorkflows, WorkflowReadProgress } from '../WorkflowTypes.js';
import { isWorkflowNeverRead } from './isWorkflowNeverRead.js';

/**
 * How far the read of a repository's workflows' runs is (actions W3c); `null` once every active workflow's were read.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowReadProgress(stored: RepositoryWorkflows): WorkflowReadProgress | null {
    const active = stored.workflows.filter(entry => entry.workflow.state === 'active');
    const unread = active.filter(isWorkflowNeverRead).length;
    return unread === 0 ? null : { read: active.length - unread, total: active.length };
}
