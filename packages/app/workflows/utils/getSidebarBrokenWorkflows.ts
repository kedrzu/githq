import type { SidebarBrokenWorkflows } from '@/shell/SidebarTypes.js';

import type { WorkflowTotals } from '../WorkflowStore.js';

/**
 * What the sidebar's "Broken workflows" says of every tracked repository (actions W1), or `null` while it is not
 * shown: it shows only while some workflow is known broken, or while its own screen is open. While some repository
 * is not read yet the total says it may grow (`1+`), and a zero is never claimed (`–`). A repository GitHub shows
 * nothing of adds nothing.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getSidebarBrokenWorkflows(totals: WorkflowTotals, screenOpen: boolean): SidebarBrokenWorkflows | null {
    const { brokenCount, hasNewBreak, hasUnread } = totals;
    if (brokenCount === 0) {
        return screenOpen ? { count: hasUnread ? '–' : '0', tone: 'none' } : null;
    }

    return { count: hasUnread ? `${brokenCount}+` : String(brokenCount), tone: hasNewBreak ? 'new' : 'settled' };
}
