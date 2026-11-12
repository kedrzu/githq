import type { ReviewThread } from '@/review/threads/ReviewThread.js';

import { getUrlAnchor } from './getUrlAnchor.js';

/**
 * Whether one of the code thread's comments is the one GitHub's anchor names (`discussion_r<id>`); never for no anchor.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function holdsAnchor(thread: ReviewThread, anchor: string | undefined) {
    return anchor !== undefined && thread.comments.some(comment => getUrlAnchor(comment.url) === anchor);
}
