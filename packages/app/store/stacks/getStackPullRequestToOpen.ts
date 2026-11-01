import type { PullRequestItem } from '@/store/ItemTypes.js';

/**
 * The pull request `Enter` on a stack's entry opens (D9): the first open one not yet approved, otherwise the first
 * open one; with none open, the last. `undefined` only for a stack with no members.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStackPullRequestToOpen(members: readonly PullRequestItem[]): PullRequestItem | undefined {
    const open = members.filter(pr => pr.state === 'OPEN' && !pr.merged);
    return open.find(pr => pr.reviewDecision !== 'APPROVED') ?? open[0] ?? members.at(-1);
}
