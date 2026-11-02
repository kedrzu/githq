import { assertNever } from '@nzyme/utils/assertNever.js';

import type { SidebarWorkflowMarker } from '@/shell/SidebarTypes.js';

import type { RepositoryWorkflowState } from '../WorkflowTypes.js';

/**
 * The marker on a tracked repository's icon in the sidebar (actions W1): bright red with a break under a day old,
 * quiet red with only older ones, a hollow ring before its workflows were first read; none when nothing is broken
 * there, or when GitHub shows nothing of them (Actions off, refused) — such a repository is never red.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getSidebarWorkflowMarker(state: RepositoryWorkflowState): SidebarWorkflowMarker | null {
    switch (state.status) {
        case 'unread':
            return 'unread';
        case 'unavailable':
            return null;
        case 'read':
            if (state.brokenCount === 0) {
                return null;
            }

            return state.hasNewBreak ? 'new' : 'settled';
        default:
            return assertNever(state.status);
    }
}
