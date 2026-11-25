import type { ReviewCommentActions } from './ReviewCommentActions.js';
import type { ReviewThreadComment } from './ReviewThread.js';

/** A code thread's comment's actions by key, each `null` where its ⋯ does not offer it. */
export interface CodeCommentActions {
    /** `.`: its menu (⋯) opened. */
    readonly menu: (() => void) | null;
    /** `Q`: quoted into its thread's reply box. */
    readonly quote: (() => void) | null;
    /** `W`: edited in place, or its open editor focused again. */
    readonly edit: (() => void) | null;
}

/** The parameters of {@link getCodeCommentActions}. */
export interface GetCodeCommentActionsParams {
    readonly comment: ReviewThreadComment;
    /** The view's actions on its code threads' comments (`useReviewCommentActions`). */
    readonly commentActions: ReviewCommentActions;
    /** Quotes the comment into its thread's reply box, as the view does it; `null` where the thread takes no reply. */
    readonly quote: (() => void) | null;
}

/**
 * A code thread's comment's menu, Quote reply and Edit by key, as its ⋯ offers them, wherever code threads show (an
 * item's thread, code review's diff): none of them while its edit is on its way, GitHub having nothing to act on yet; no
 * menu while edited, the editor in its place; Quote reply where its thread takes a reply.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCodeCommentActions({
    comment,
    commentActions,
    quote,
}: GetCodeCommentActionsParams): CodeCommentActions {
    const { actions } = commentActions;
    const onItsWay = commentActions.getEdit(comment.id) !== null;
    const menu = !onItsWay && !actions.editors.has(comment.id);
    return {
        menu: menu ? () => actions.setMenuOpen(comment.id, true) : null,
        quote: menu ? quote : null,
        edit: !onItsWay && comment.viewerCanUpdate ? () => void actions.editByKey(comment.id, comment.body) : null,
    };
}
