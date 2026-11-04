import type { WorkflowRefSettings } from '../WorkflowTypes.js';

/**
 * Whether nothing raises alerts in a repository (actions W9, W14): the default branch is off and there are no patterns.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isWorkflowAlertsOff(settings: WorkflowRefSettings): boolean {
    return !settings.defaultBranch && settings.refs.length === 0;
}
