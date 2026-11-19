import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { MaybeRefOrGetter } from 'vue';

import { useCommentActions } from '@/comments/useCommentActions.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import type { ReviewThread } from './ReviewThread.js';
import type { ReviewCommentActions } from './ReviewCommentActions.js';

/** The parameters of {@link useReviewCommentActions}. */
export interface UseReviewCommentActionsOptions {
    /** The pull request: another closes every editor, whose Update would save into the wrong one. */
    readonly subject: MaybeRefOrGetter<string>;
    /** Code review's writing of the pull request, which edits and deletes them; none, nothing is sent. */
    readonly writing: MaybeRefOrGetter<ReviewWriting | null>;
    /** The pull request's threads, as the view draws them: Quote reply finds the comment's thread among them. */
    readonly threads: MaybeRefOrGetter<readonly ReviewThread[]>;
    readonly repository: MaybeRefOrGetter<string>;
    readonly itemNumber: MaybeRefOrGetter<number>;
    readonly people?: MaybeRefOrGetter<readonly ItemUser[] | undefined>;
    /** Quote reply: the Markdown quoted into the thread's reply box, once the menu gave the focus back. */
    readonly onQuote: (thread: ReviewThread, body: string) => void;
}

/**
 * A view's actions on its code threads' comments (F15), the cards' own `useCommentActions` written through code review's
 * writing: Edit and Delete go to `ReviewWriting`, an edit GitHub did not take opens again, and Quote reply goes into the
 * reply box of the comment's own thread rather than a composer.
 */
export function useReviewCommentActions(options: UseReviewCommentActionsOptions): ReviewCommentActions {
    const writing = makeRef(options.writing);
    const threads = makeRef(options.threads);
    const repository = makeRef(options.repository);
    const itemNumber = makeRef(options.itemNumber);
    const people = makeRef(options.people);
    /** The thread of the comment Quote reply was picked on, until the menu hands the quote over. */
    let quoting: ReviewThread | null = null;

    const actions = useCommentActions({
        subject: options.subject,
        failedEdits: () => writing.value?.failedEdits,
        onEdit: edit,
        onDiscardEdit: commentId => {
            if (commentId !== null) {
                writing.value?.discardFailedEdit(commentId);
            }
        },
        onQuote: body => {
            const thread = quoting;
            quoting = null;
            if (thread) {
                options.onQuote(thread, body);
            }
        },
    });

    return reactive<ReviewCommentActions>({
        actions,
        repository,
        itemNumber,
        people,
        getEdit,
        quote,
    });

    function getEdit(commentId: string) {
        return writing.value?.getCommentEdit(commentId) ?? null;
    }

    function quote(commentId: string, body: string) {
        quoting = threads.value.find(thread => thread.comments.some(({ id }) => id === commentId)) ?? null;
        actions.quote(body);
    }

    function edit(request: EditRequest) {
        switch (request.kind) {
            case 'editComment':
                writing.value?.editComment(request.commentId, request.body);
                break;
            case 'deleteComment':
                writing.value?.deleteComment(request.commentId);
                break;
            // A review comment's editor and menu ask for nothing else.
            default:
                break;
        }
    }
}
