import type { StackPip, StackPullRequestPip } from './describeStack.js';

/**
 * The pull requests of a stack the copy holds, first to last: its pips but the places missing.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMembers(pips: readonly StackPip[]): StackPullRequestPip[] {
    return pips.filter((pip): pip is StackPullRequestPip => pip.kind !== 'missing');
}
