import type { ReviewCommentWay } from './ReviewWriting.js';

/** What a comment box's two keys do, `⌘↵` first and `⌘⇧↵` second. */
export interface CommentWays {
    readonly first: ReviewCommentWay;
    readonly second: ReviewCommentWay;
}

/**
 * What a comment's keys do (D17, D22): with a draft open it can only join it, the second key adding it and submitting
 * the whole draft; with none, the first sends it at once or starts a draft as the setting says, the second the other.
 * Code review's comment box and a reply in an item's thread go the same way.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCommentWays(draftOpen: boolean, draftFirst: boolean): CommentWays {
    if (draftOpen) {
        return { first: 'joinDraft', second: 'joinAndSubmit' };
    }

    return draftFirst ? { first: 'startDraft', second: 'single' } : { first: 'single', second: 'startDraft' };
}
