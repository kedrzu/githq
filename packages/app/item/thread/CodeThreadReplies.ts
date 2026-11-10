import type { ReviewCommentFailure, ReviewSentStatus, ReviewWriteFailure } from '@/review/writing/ReviewWriting.js';
import type { ItemUser } from '@/store/ItemTypes.js';

/**
 * The replies written in an item's thread's code threads, and what writes them: code review's own boxes
 * (`ReviewWriting`), so a reply begun in one shows in the other. Reactive; handed down to every code thread.
 */
export interface CodeThreadReplies {
    /** `owner/name`, which the reply editor's preview and suggestions are of. */
    readonly repository: string;
    /** The number of the item, which `#` does not suggest. */
    readonly itemNumber: number;
    /** The thread's people, whom `@` suggests first. */
    readonly people: readonly ItemUser[];
    /** What `Mod+Enter` does with a reply, as code review's first key: "Reply", "Add to draft", "Start a review". */
    readonly saveLabel: string;
    /** The thread's reply being written and those on their way; `null` with none. */
    get(threadId: string): CodeThreadReply | null;
    /** Why the thread's last change of state didn't go through; it shows as it was again. */
    getResolveFailure(threadId: string): ReviewWriteFailure | null;
    setText(threadId: string, text: string): void;
    /** The reply box's footer asks whether to discard it, or stops asking. */
    setAsking(threadId: string, asking: boolean): void;
    send(threadId: string): void;
    /** Cancel on an empty reply, or Discard: the box goes, its text with it. */
    cancel(threadId: string): void;
}

/** A code thread's replies of the viewer's: the one being written and those sent until the threads read have them. */
export interface CodeThreadReply {
    /** The box, while written or after GitHub refused it; `null` once it was sent. */
    readonly box: CodeThreadReplyBox | null;
    readonly sent: readonly CodeThreadSentReply[];
}

/** A reply box open in a code thread. */
export interface CodeThreadReplyBox {
    readonly text: string;
    /** Why it did not go, its text kept; `null` while not sent yet. */
    readonly failure: ReviewCommentFailure | null;
    /** It holds text, or GitHub refused it: leaving it asks first. */
    readonly changed: boolean;
    /** Its footer asks whether to discard it. */
    readonly asking: boolean;
    /** It takes the focus: the user asked to reply. */
    readonly focused: boolean;
}

/** A reply on its way, or taken and not yet among the threads read. */
export interface CodeThreadSentReply {
    readonly id: string;
    readonly status: ReviewSentStatus;
}
