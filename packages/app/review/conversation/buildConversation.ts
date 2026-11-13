import type { FailedComment } from '@/edits/CommentDrafts.js';
import type { ItemComment, ItemReviewSummary } from '@/store/ItemDetailTypes.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';

/** One entry of a pull request's conversation. */
export type ConversationEntry =
    | { readonly kind: 'comment'; readonly id: string; readonly comment: ItemComment }
    | {
          readonly kind: 'summary';
          readonly id: string;
          readonly review: ItemReviewSummary;
          readonly threads: ReviewOwnThreads | null;
      }
    | { readonly kind: 'failedComment'; readonly id: string; readonly failed: FailedComment };

/** The parameters of {@link buildConversation}. */
export interface BuildConversationParams {
    readonly comments: readonly ItemComment[];
    readonly summaries: readonly ItemReviewSummary[];
    /** What each review started, by its id. */
    readonly threads: ReadonlyMap<string, ReviewOwnThreads>;
    /** The user's comments GitHub did not take, in the order they were written. */
    readonly failedComments?: readonly FailedComment[];
}

/**
 * Comments and review summaries in one time order, newest last, as an item's thread orders them (`buildThread`): the
 * user's comments on their way after everything GitHub told, then those GitHub did not take. A review saying nothing is
 * left out: GitHub makes one of every reply to a thread, `COMMENTED` with no text, and it has its place in the diff.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildConversation({
    comments,
    summaries,
    threads,
    failedComments = [],
}: BuildConversationParams): ConversationEntry[] {
    const timed: { readonly at: number; readonly entry: ConversationEntry }[] = [];
    const pending: ConversationEntry[] = [];
    for (const comment of comments) {
        const entry = { kind: 'comment', id: comment.id, comment } as const;
        if (comment.pendingBody === undefined) {
            timed.push({ at: Date.parse(comment.createdAt), entry });
        } else {
            pending.push(entry);
        }
    }

    for (const review of summaries) {
        const own = threads.get(review.id) ?? null;
        if (review.state !== 'COMMENTED' || review.bodyHtml !== '' || own !== null) {
            timed.push({
                at: Date.parse(review.submittedAt),
                entry: { kind: 'summary', id: review.id, review, threads: own },
            });
        }
    }

    return [
        ...timed.toSorted((a, b) => a.at - b.at).map(({ entry }) => entry),
        ...pending,
        ...failedComments.map((failed): ConversationEntry => ({ kind: 'failedComment', id: `failed:${failed.id}`, failed })),
    ];
}
