import type { ReviewThread } from './ReviewThread.js';

export interface IsReviewThreadWholeParams {
    readonly thread: ReviewThread;
    /** The reader opened it (`ReviewFiles.isThreadOpen`), which a resolved one needs to show more than its line. */
    readonly open: boolean;
    /** The viewer's reply box is in it, which opens it. */
    readonly replying: boolean;
}

/**
 * Whether a thread shows whole, its comments one under another, rather than folded to its resolved line: open, or resolved
 * and opened, or replied to. What its Resolve band and the cursor's stops on its comments (D44) go by.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isReviewThreadWhole({ thread, open, replying }: IsReviewThreadWholeParams): boolean {
    return !thread.isResolved || open || replying;
}
