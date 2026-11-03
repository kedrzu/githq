import { defineContext } from '@nzyme/vue-utils/context.js';

import type { MergePanelOpenOptions } from './MergePanelStore.js';
import type { MergeRecord, PullRequestCommand } from './MergeTypes.js';

/**
 * Merging a pull request from a list (merging D7, D9): whether the viewer may merge one, the merge panel for it, how
 * its last merge ended when it did not merge, for its row to say (PM37), and its ordinary commands (D16).
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
    /** What this session knows of the pull request's last merge that did not end merged (D15); reactive. */
    getRecord(itemId: string): MergeRecord | null;
    /** The ordinary commands that apply to the pull request now (`getPullRequestCommands`); reactive. */
    getCommands(itemId: string): readonly PullRequestCommand[];
    /** Runs one, on that pull request whatever is selected by then (merging D15, D16). */
    run(itemId: string, command: PullRequestCommand): void;
}

export const MergeContext = defineContext<MergeContext>('MergeContext');
