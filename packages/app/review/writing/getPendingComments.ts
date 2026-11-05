import type { ReviewThread } from '../threads/ReviewThread.js';
import { getFileName } from '../utils/getFileName.js';
import { getHtmlFirstLine } from '../utils/getHtmlFirstLine.js';

/** A comment in the viewer's draft, as the submit and the discard dialogs list it (CR75, CR39). */
export interface PendingComment {
    readonly id: string;
    /** `engine.ts:48`. */
    readonly where: string;
    readonly excerpt: string;
}

/**
 * The comments of the viewer's draft, in the threads' order, as the threads last read know them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getPendingComments(threads: readonly ReviewThread[]): PendingComment[] {
    const comments: PendingComment[] = [];
    for (const thread of threads) {
        const line = thread.line ?? thread.originalLine;
        for (const comment of thread.comments) {
            if (comment.state === 'PENDING') {
                comments.push({
                    id: comment.id,
                    where: getFileName(thread.path) + (line === null ? '' : `:${line}`),
                    excerpt: getHtmlFirstLine(comment.bodyHTML),
                });
            }
        }
    }

    return comments;
}
