import { isClosedPullRequest } from '@/store/isClosedPullRequest.js';
import { isMergedPullRequest } from '@/store/isMergedPullRequest.js';
import type { StackPullRequestPip, StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

/**
 * The state a stack's pull request shows on its own row or square: its pip's, but a merged or closed one as it is where
 * its pip is pale while the copy is incomplete (stacked PRs D7).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMemberKind({ kind, pullRequest }: StackPullRequestPip): StackPullRequestPipKind {
    if (isMergedPullRequest(pullRequest)) {
        return 'merged';
    }

    return isClosedPullRequest(pullRequest) ? 'closed' : kind;
}
