import type { CommentActions } from '@/comments/useCommentActions.js';
import type { ItemUser } from '@/store/ItemTypes.js';

/**
 * What a code thread's comments do from their ⋯ (F15) — Edit in place, Quote reply, Copy link, Delete — handed down from
 * the view that writes them (code review's diff, an item's thread; `useReviewCommentActions`), so a comment acts the same
 * in both. Reactive.
 */
export interface ReviewCommentActions {
    /** The view's `useCommentActions`, by comment id. */
    readonly actions: CommentActions;
    /** `owner/name`, which the editor's preview and suggestions are of. */
    readonly repository: string;
    /** The pull request's number. */
    readonly itemNumber: number;
    /** Whom `@` suggests first in the editor. */
    readonly people?: readonly ItemUser[];
    /** The Markdown of the comment's edit on its way to GitHub (`ReviewWriting.getCommentEdit`); `null` with none. */
    getEdit(commentId: string): string | null;
    /**
     * Quote reply picked on the comment: once the menu closed, the view quotes it into the reply box of the comment's
     * own thread, which takes the focus. Offered only where the thread takes a reply (`ReviewComment.canQuote`).
     */
    quote(commentId: string, body: string): void;
}
