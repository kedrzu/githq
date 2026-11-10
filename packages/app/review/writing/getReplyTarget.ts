import type { ReviewThread } from '../threads/ReviewThread.js';

import type { ReviewCommentTarget } from './ReviewWriting.js';

/** Where a reply in a thread sits, all but its file's path, which code review takes from its row. */
export type ReplyTarget = Pick<ReviewCommentTarget, 'side' | 'line' | 'startLine' | 'threadId'>;

/**
 * A reply's lines are its thread's: its last line, or the one it was written on when it is outdated, and a range only
 * when it spans more than one. Code review and a reply in an item's thread open the same box on them.
 * @__NO_SIDE_EFFECTS__
 */
export function getReplyTarget(thread: ReviewThread): ReplyTarget {
    const line = thread.line ?? thread.originalLine ?? 1;
    return {
        side: thread.diffSide === 'LEFT' ? 'before' : 'after',
        line,
        startLine: thread.startLine === null || thread.startLine === line ? null : thread.startLine,
        threadId: thread.id,
    };
}
