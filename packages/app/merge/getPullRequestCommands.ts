import type { EditPermissions } from '@/edits/getEditPermissions.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import type { PullRequestCommand } from './MergeTypes.js';

/** What {@link getPullRequestCommands} decides from. */
export interface GetPullRequestCommandsParams {
    readonly pr: PullRequestItem;
    readonly permissions: EditPermissions;
    /** The local copy: which of a stack's pull requests is its first open one. */
    readonly items: readonly Item[];
    /** A merge that took it has no known end yet: it may still land, so nothing goes on from it (PM29). */
    readonly outcomeUnknown: boolean;
}

/**
 * The ordinary commands that apply to the pull request now (merging D16), in the order the palette lists them: one that
 * can't take a command isn't offered it. Updating is for a branch behind, without conflicts, not being merged or in the
 * queue; in a stack only for its first open one (a later one behind needs GitHub's "Rebase stack"), told from the copy:
 * GitHub doesn't renumber the positions as members land. Failed checks by the row's counts: the edit reads which of them
 * re-run.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestCommands(params: GetPullRequestCommandsParams): PullRequestCommand[] {
    const { pr, permissions, items, outcomeUnknown } = params;
    const commands: PullRequestCommand[] = [];
    if (permissions.updateBranch && !outcomeUnknown && canUpdateBranch(pr, items)) {
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

function canUpdateBranch(pr: PullRequestItem, items: readonly Item[]) {
    return (
        isOpenPullRequest(pr) &&
        pr.merging === undefined &&
        !pr.mergeQueueEntry &&
        pr.mergeable !== 'CONFLICTING' &&
        (pr.mergeStateStatus === 'BEHIND' || pr.behindBase) &&
        !hasOpenMemberBefore(pr, items)
    );
}

function hasOpenMemberBefore({ stack }: PullRequestItem, items: readonly Item[]) {
    return (
        stack !== null &&
        items.some(
            item =>
                item.kind === 'pullRequest' &&
                item.stack?.id === stack.id &&
                item.stack.position < stack.position &&
                isOpenPullRequest(item),
        )
    );
}
