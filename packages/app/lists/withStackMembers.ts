import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

/** What {@link withStackMembers} adds to. */
export interface WithStackMembersParams<T> {
    /** The entries a list's filter matches. */
    readonly matched: readonly T[];
    /** Every entry the list would show without its filter, in its order. */
    readonly all: readonly T[];
    /** The pull request an entry is; `null` for anything else (an issue, a draft). */
    readonly getPullRequest: (value: T) => PullRequestItem | null;
}

/**
 * The entries a filtered list shows (D3, SP25): those its filter matches and, of a stack any open pull request of which
 * matches, its other open ones, so its entry shows whole — in the order of `all`. `matched` itself when nothing is added.
 * `foldStacks`, told which match, keeps them only beside one that does.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function withStackMembers<T>(params: WithStackMembersParams<T>): readonly T[] {
    const { matched, all, getPullRequest } = params;
    const stacks = new Set<string>();
    for (const value of matched) {
        const stackId = getOpenStackId(value);
        if (stackId !== null) {
            stacks.add(stackId);
        }
    }

    if (stacks.size === 0) {
        return matched;
    }

    const kept = new Set(matched);
    const shown = all.filter(value => kept.has(value) || isMemberOfMatched(value));
    return shown.length === matched.length ? matched : shown;

    function isMemberOfMatched(value: T) {
        const stackId = getOpenStackId(value);
        return stackId !== null && stacks.has(stackId);
    }

    function getOpenStackId(value: T) {
        const pullRequest = getPullRequest(value);
        return pullRequest?.stack && isOpenPullRequest(pullRequest) ? pullRequest.stack.id : null;
    }
}
