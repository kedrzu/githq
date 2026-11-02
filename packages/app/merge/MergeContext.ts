import { defineContext } from '@nzyme/vue-utils/context.js';

import type { MergePanelOpenOptions } from './MergePanelStore.js';

/**
 * Merging a pull request from a list (merging D7, D9): whether the viewer may merge one, and the merge panel for it.
 * The app's screens provide it; a list provides its own over it, which also moves on to the next row once the merge
 * is sent (PM32a). Where nobody provides it — a component on its own, in a story — merging is not offered.
 */
export interface MergeContext {
    /**
     * Whether the merge panel opens for the pull request (`EditPermissions.mergePanel`): the viewer may merge it, or it
     * is being merged and the panel shows that (PM24); reactive.
     */
    canOpen(itemId: string): boolean;
    /** Opens the merge panel for the pull request. */
    open(itemId: string, options?: MergePanelOpenOptions): void;
}

export const MergeContext = defineContext<MergeContext>('MergeContext');
