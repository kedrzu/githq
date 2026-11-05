import type { StackPullRequestPip } from './describeStack.js';

/**
 * Where the pull request is in its stack, from 1: "2 of 4". GitHub's word first, then how far along the copy has it. One
 * not among the members reads as the first of them.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackPlace(members: readonly StackPullRequestPip[], id: string): number {
    const index = Math.max(
        members.findIndex(pip => pip.pullRequest.id === id),
        0,
    );
    return members[index]?.pullRequest.stack?.position ?? index + 1;
}
