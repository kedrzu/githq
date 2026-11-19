import { useCommentActions } from '@/comments/useCommentActions.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import type { ReviewCommentActions } from '@/review/threads/ReviewCommentActions.js';

/** The parameters of {@link useSampleReviewCommentActions}. */
export interface UseSampleReviewCommentActionsOptions {
    /** Edits on their way, by comment id. */
    readonly edits?: Readonly<Record<string, string>>;
    readonly onEdit?: (request: EditRequest) => void;
    readonly onQuote?: (body: string) => void;
}

/** A view's comment actions for a story of a code thread's comments: call it in the story's `setup`. */
export function useSampleReviewCommentActions(
    options: UseSampleReviewCommentActionsOptions = {},
): ReviewCommentActions {
    const actions = useCommentActions({
        subject: 'PR_1202',
        failedEdits: [],
        onEdit: request => options.onEdit?.(request),
        onDiscardEdit: () => undefined,
        onQuote: body => options.onQuote?.(body),
    });

    return {
        actions,
        canQuote: true,
        repository: 'fitloop/webapp',
        itemNumber: 1202,
        getEdit: commentId => options.edits?.[commentId] ?? null,
    };
}
