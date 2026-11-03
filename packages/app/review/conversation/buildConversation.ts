import type { ItemComment, ItemReviewSummary } from '@/store/ItemDetailTypes.js';

import type { ReviewThreadComment } from '../threads/ReviewThread.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';

/** One entry of a pull request's conversation. */
export type ConversationEntry =
    | {
          readonly kind: 'comment';
          readonly id: string;
          readonly comment: Pick<ReviewThreadComment, 'author' | 'bodyHTML' | 'createdAt' | 'url'>;
      }
    | {
          readonly kind: 'summary';
          readonly id: string;
          readonly review: ItemReviewSummary;
          readonly threads: ReviewOwnThreads | null;
      };

/** The parameters of {@link buildConversation}. */
export interface BuildConversationParams {
    readonly comments: readonly ItemComment[];
    readonly summaries: readonly ItemReviewSummary[];
    /** What each review started, by its id. */
    readonly threads: ReadonlyMap<string, ReviewOwnThreads>;
}

/**
 * Comments and review summaries in one time order, newest last. A review saying nothing is left out: GitHub makes one of
 * every reply to a thread, `COMMENTED` with no text, and it has its place in the diff. A comment on its way to GitHub
 * isn't on the pull request yet, and shows once it is.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildConversation({ comments, summaries, threads }: BuildConversationParams): ConversationEntry[] {
    const timed: { readonly at: number; readonly entry: ConversationEntry }[] = [];
    for (const { id, author, url, createdAt, bodyHtml, pendingBody } of comments) {
        if (pendingBody === undefined) {
            timed.push({
                at: Date.parse(createdAt),
                entry: { kind: 'comment', id, comment: { author, url, createdAt, bodyHTML: bodyHtml } },
            });
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

    return timed.toSorted((a, b) => a.at - b.at).map(({ entry }) => entry);
}
