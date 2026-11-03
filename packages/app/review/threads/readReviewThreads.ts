import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';

import type { ReviewThread, ReviewThreadComment } from './ReviewThread.js';

/** The parameters of {@link readReviewThreads}. */
export interface ReadReviewThreadsParams {
    readonly sdk: GitHubSdk;
    readonly owner: string;
    readonly name: string;
    readonly number: number;
    /** Called before every request: throws when GitHub is not to be asked. */
    readonly assertMayAsk: () => void;
}

/**
 * Every review thread of a pull request with all its comments, whatever their number: a thread left short would hide part
 * of a conversation. `null` when GitHub has no such pull request.
 */
export async function readReviewThreads(params: ReadReviewThreadsParams): Promise<ReviewThread[] | null> {
    const { sdk, owner, name, number, assertMayAsk } = params;
    const threads: ReviewThread[] = [];
    let after: string | null = null;
    do {
        assertMayAsk();
        const { repository } = await sdk.PullRequestReviewThreads({ owner, name, number, after });
        const page = repository?.pullRequest?.reviewThreads;
        if (!page) {
            return null;
        }

        for (const node of page.nodes ?? []) {
            if (node) {
                const { comments, ...thread } = node;
                const first = (comments.nodes ?? []).filter(comment => comment !== null);
                threads.push({
                    ...thread,
                    comments: comments.pageInfo.hasNextPage
                        ? [...first, ...(await readLaterComments(params, node.id, comments.pageInfo.endCursor))]
                        : first,
                });
            }
        }

        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after !== null);

    return threads;
}

async function readLaterComments(
    { sdk, assertMayAsk }: ReadReviewThreadsParams,
    id: string,
    cursor: string | null,
): Promise<ReviewThreadComment[]> {
    const comments: ReviewThreadComment[] = [];
    let after = cursor;
    while (after !== null) {
        assertMayAsk();
        const { node } = await sdk.ReviewThreadComments({ id, after });
        const page = node?.comments;
        comments.push(...(page?.nodes ?? []).filter(comment => comment !== null));
        after = page?.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    }

    return comments;
}
