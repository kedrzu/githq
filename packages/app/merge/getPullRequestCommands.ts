import type { EditPermissions } from '@/edits/getEditPermissions.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { PullRequestCommand } from './MergeTypes.js';

/**
 * The ordinary commands that apply to the pull request now (merging D16), in the order the palette lists them: one that
 * can't take a command isn't offered it. Updating is for a branch behind, without conflicts, not being merged or in the
 * queue; in a stack only for its first (a later one behind needs GitHub's "Rebase stack"). Failed checks by the row's
 * counts: the edit reads which of them re-run.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestCommands(pr: PullRequestItem, permissions: EditPermissions): PullRequestCommand[] {
    const commands: PullRequestCommand[] = [];
    if (permissions.updateBranch && canUpdateBranch(pr)) {
        commands.push({ kind: 'updateBranch', method: 'MERGE' }, { kind: 'updateBranch', method: 'REBASE' });
    }

    if (permissions.rerunChecks && pr.merging === undefined && (pr.checks?.failing ?? 0) > 0) {
        commands.push({ kind: 'rerunFailedChecks' });
    }

    if (permissions.deleteBranch) {
        commands.push({ kind: 'deleteBranch' });
    }

    if (permissions.restoreBranch) {
        commands.push({ kind: 'restoreBranch' });
    }

    if (permissions.revert) {
        commands.push({ kind: 'revert' });
    }

    if (permissions.merge && pr.mergeQueueEntry) {
        commands.push({ kind: 'dequeue' });
    }

    return commands;
}

function canUpdateBranch(pr: PullRequestItem) {
    return (
        isOpenPullRequest(pr) &&
        pr.merging === undefined &&
        !pr.mergeQueueEntry &&
        pr.mergeable !== 'CONFLICTING' &&
        (pr.mergeStateStatus === 'BEHIND' || pr.behindBase) &&
        (pr.stack === null || pr.stack.position === 1)
    );
}
