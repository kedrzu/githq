import { isMergedPullRequest } from '@/store/isMergedPullRequest.js';
import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { StackMergeOutcome, StackMergeRecord } from './StackMergeTypes.js';

/** What a stack's last merge is read against. */
export interface GetStackMergeOutcomeParams {
    readonly record: StackMergeRecord | null;
    /** The stack's pull requests as the copy holds them now, first to last. */
    readonly members: readonly PullRequestItem[];
}

/**
 * How a stack's last merge that did not end merged reads now (stacked PRs D11): from what the copy holds of every
 * pull request it took, never "all" or "none" by assumption. A head moved since it was sent says nothing merged and
 * which one has the new commit (SP62); refused partway, nothing is known until the stack is read again (SP60), then
 * what landed shows (SP59); with nothing landed it was refused (SP61). `null` for no record, or every one landed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMergeOutcome(params: GetStackMergeOutcomeParams): StackMergeOutcome | null {
    const { record, members } = params;
    if (!record) {
        return null;
    }

    if (record.kind === 'unknown') {
        return { kind: 'unknown', accepted: record.accepted };
    }

    const { reason } = record;
    const going = record.sent.going.map(sent => ({ sent, pr: members.find(member => member.id === sent.itemId) }));
    const moved = going.find(({ sent, pr }) => pr && isOpenPullRequest(pr) && pr.headRefOid !== sent.head)?.pr;
    if (moved) {
        return { kind: 'headMoved', pullRequest: moved };
    }

    if (record.partway && !record.read) {
        return { kind: 'reading', reason };
    }

    const landed = going.filter(({ pr }) => pr && isMergedPullRequest(pr)).length;
    const stop = going.find(({ pr }) => !pr || !isMergedPullRequest(pr));
    if (!stop) {
        return null;
    }

    return landed > 0 && stop.pr ? { kind: 'stopped', at: stop.pr, landed, reason } : { kind: 'refused', reason };
}
