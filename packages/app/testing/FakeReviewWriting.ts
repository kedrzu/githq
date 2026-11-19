import { shallowReactive } from 'vue';

import type { FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import type {
    ReviewCommentStatus,
    ReviewCommentTarget,
    ReviewCommentWay,
    ReviewWriteFailure,
    ReviewWriting,
} from '@/review/writing/ReviewWriting.js';
import { NO_REVIEW_SUBMISSION, REVIEW_FINISH_IDLE } from '@/review/writing/ReviewWriting.js';

/** A send {@link FakeReviewWriting} recorded. */
export interface FakeReviewSend {
    readonly body: string;
    readonly way: ReviewCommentWay;
    readonly threadId: string | null;
}

/** A change of a thread's state {@link FakeReviewWriting} recorded. */
export interface FakeReviewResolve {
    readonly threadId: string;
    readonly resolved: boolean;
}

/** An edit of a comment {@link FakeReviewWriting} recorded. */
export interface FakeReviewCommentEdit {
    readonly commentId: string;
    readonly body: string;
}

/**
 * A pull request's writing for an item thread's stories and specs: it keeps its boxes in memory as code review's does —
 * opened, typed in, closed, sent ("Sending…" until {@link answer}) — and records sends, resolves, edits ("Sending…" until
 * {@link answerEdit}) and deletes; nothing reaches GitHub. A class, so that Storybook hands it over as it is rather than merging it as a plain object.
 */
export class FakeReviewWriting implements ReviewWriting {
    readonly draftOpen: boolean;
    readonly draftCount = 0;
    readonly finish = REVIEW_FINISH_IDLE;
    readonly canRetry = false;
    readonly canDismiss = false;
    readonly submission = NO_REVIEW_SUBMISSION;
    /** An item thread discards no box: its reply editor asks, and nothing restores. */
    readonly discarded = null;

    private readonly state = shallowReactive<FakeState>({
        targets: [],
        texts: new Map(),
        statuses: new Map(),
        sent: [],
        resolved: [],
        edits: [],
        editing: new Map(),
        failedEdits: [],
        deleted: [],
        deleteFailures: new Map(),
    });

    private next = 0;

    private readonly onResolve: ((resolve: FakeReviewResolve) => void) | undefined;

    private readonly onDeleteComment: ((commentId: string) => void) | undefined;

    private readonly itemId: string;

    constructor(options: FakeReviewWritingOptions = {}) {
        this.draftOpen = options.draftOpen ?? false;
        this.onResolve = options.onResolve;
        this.onDeleteComment = options.onDeleteComment;
        this.itemId = options.itemId ?? 'PR_1';
    }

    get targets(): readonly ReviewCommentTarget[] {
        return this.state.targets;
    }

    get hasText(): boolean {
        return [...this.state.texts.values()].some(text => text.trim() !== '');
    }

    /** What {@link send} was asked to send, oldest first. */
    get sent(): readonly FakeReviewSend[] {
        return this.state.sent;
    }

    /** What {@link setResolved} was asked, oldest first. */
    get resolved(): readonly FakeReviewResolve[] {
        return this.state.resolved;
    }

    /** What {@link editComment} was asked, oldest first. */
    get edits(): readonly FakeReviewCommentEdit[] {
        return this.state.edits;
    }

    /** What {@link deleteComment} was asked to delete, oldest first. */
    get deleted(): readonly string[] {
        return this.state.deleted;
    }

    get failedEdits(): readonly FailedTextEdit[] {
        return this.state.failedEdits;
    }

    setSubmission(): void {}

    open(wanted: Omit<ReviewCommentTarget, 'id'>): ReviewCommentTarget {
        const held = this.state.targets.find(
            target => target.threadId === wanted.threadId && this.getStatus(target.id).kind !== 'sending',
        );
        if (held) {
            return held;
        }

        const target = { ...wanted, id: `box${++this.next}` };
        this.state.targets = [...this.state.targets, target];
        return target;
    }

    setRange(): void {}

    hasCodeChanged(): boolean {
        return false;
    }

    close(id: string): void {
        this.state.targets = this.state.targets.filter(target => target.id !== id);
        this.state.texts = withValue(this.state.texts, id, null);
        this.state.statuses = withValue(this.state.statuses, id, null);
    }

    discardBox(id: string): void {
        this.close(id);
    }

    restoreDiscarded(): null {
        return null;
    }

    forgetDiscarded(): void {}

    getText(id: string): string {
        return this.state.texts.get(id) ?? '';
    }

    setText(id: string, text: string): void {
        this.state.texts = withValue(this.state.texts, id, text);
    }

    getStatus(id: string): ReviewCommentStatus {
        return this.state.statuses.get(id) ?? { kind: 'editing' };
    }

    send(id: string, way: ReviewCommentWay): void {
        const body = this.getText(id).trim();
        const target = this.state.targets.find(other => other.id === id);
        if (!target || body === '') {
            return;
        }

        this.state.sent = [...this.state.sent, { body, way, threadId: target.threadId }];
        this.state.statuses = withValue(this.state.statuses, id, { kind: 'sending', way, body });
    }

    /** GitHub's answer to the box, as the real writing would show it: a failure keeps the text. */
    answer(id: string, status: ReviewCommentStatus): void {
        this.state.statuses = withValue(this.state.statuses, id, status);
    }

    submit(): void {}

    discard(): void {}

    retry(): void {}

    dismiss(): void {}

    setResolved(threadId: string, resolved: boolean): void {
        this.state.resolved = [...this.state.resolved, { threadId, resolved }];
        this.onResolve?.({ threadId, resolved });
    }

    getResolveFailure(): ReviewWriteFailure | null {
        return null;
    }

    editComment(commentId: string, body: string): void {
        this.state.edits = [...this.state.edits, { commentId, body }];
        this.state.editing = withValue(this.state.editing, commentId, body);
        this.discardFailedEdit(commentId);
    }

    getCommentEdit(commentId: string): string | null {
        return this.state.editing.get(commentId) ?? null;
    }

    /** GitHub's answer to the comment's edit on its way: a failure opens its editor again with its text and why. */
    answerEdit(commentId: string, failure: EditFailureReason | null): void {
        const body = this.state.editing.get(commentId);
        this.state.editing = withValue(this.state.editing, commentId, null);
        if (failure && body !== undefined) {
            const failed = { itemId: this.itemId, commentId, body, reason: failure };
            this.state.failedEdits = [...this.state.failedEdits, failed];
        }
    }

    discardFailedEdit(commentId: string): void {
        this.state.failedEdits = this.state.failedEdits.filter(edit => edit.commentId !== commentId);
    }

    deleteComment(commentId: string): void {
        this.state.deleted = [...this.state.deleted, commentId];
        this.onDeleteComment?.(commentId);
    }

    /** A deletion in the thread refused, as the real writing would show it; `null` clears it. */
    failDelete(threadId: string, failure: ReviewWriteFailure | null): void {
        this.state.deleteFailures = withValue(this.state.deleteFailures, threadId, failure);
    }

    getDeleteFailure(threadId: string): ReviewWriteFailure | null {
        return this.state.deleteFailures.get(threadId) ?? null;
    }
}

/** What {@link FakeReviewWriting} starts with. */
export interface FakeReviewWritingOptions {
    /** The viewer's draft review is open: a reply can only join it. */
    readonly draftOpen?: boolean;
    /** Draws a resolve or an unresolve, as the real writing does at once: the story's threads are the caller's. */
    readonly onResolve?: (resolve: FakeReviewResolve) => void;
    /** Draws a comment deleted, as the real writing does at once: the story's threads are the caller's. */
    readonly onDeleteComment?: (commentId: string) => void;
    /** The pull request's id its failed edits name; `PR_1` by default. */
    readonly itemId?: string;
}

/** What the fake holds, replaced whole on each change. */
interface FakeState {
    targets: readonly ReviewCommentTarget[];
    texts: ReadonlyMap<string, string>;
    statuses: ReadonlyMap<string, ReviewCommentStatus>;
    sent: readonly FakeReviewSend[];
    resolved: readonly FakeReviewResolve[];
    edits: readonly FakeReviewCommentEdit[];
    /** By comment: the Markdown of its edit on its way. */
    editing: ReadonlyMap<string, string>;
    failedEdits: readonly FailedTextEdit[];
    deleted: readonly string[];
    deleteFailures: ReadonlyMap<string, ReviewWriteFailure>;
}

function withValue<T>(map: ReadonlyMap<string, T>, id: string, value: T | null): ReadonlyMap<string, T> {
    const copy = new Map(map);
    if (value === null) {
        copy.delete(id);
    } else {
        copy.set(id, value);
    }

    return copy;
}
