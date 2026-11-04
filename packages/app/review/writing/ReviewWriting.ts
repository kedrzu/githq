import type { PullRequestReviewEvent } from '@githq/github/generated.gen.js';

import type { DiffLineSide } from '../diff/buildDiffRows.js';

/** Where a comment goes in the code. Stays the same while it is written, so that its row does not move on a key press. */
export interface ReviewCommentTarget {
    readonly id: string;
    readonly path: string;
    readonly side: DiffLineSide;
    /** Its last line, 1-based, which it sits under. */
    readonly line: number;
    /** Where a range starts, on the same side; `null` for one line. */
    readonly startLine: number | null;
    /** The thread it replies in, whose lines these are; `null` for a comment of its own. */
    readonly threadId: string | null;
}

/**
 * What a key of the comment box does (D17, D22). `single`: out at once. `startDraft`: a draft review begins with it. With a
 * draft open only these two: `joinDraft` adds it, `joinAndSubmit` adds it and submits the whole draft as a comment review.
 */
export type ReviewCommentWay = 'single' | 'startDraft' | 'joinDraft' | 'joinAndSubmit';

/** Why GitHub didn't take a write. */
export type ReviewWriteFailure =
    /** GitHub's own words; `null` when it refused without any. */
    | { readonly kind: 'refused'; readonly message: string | null }
    /** No answer: it may or may not have got there. */
    | { readonly kind: 'notReached' };

/** Why a comment box's text didn't go: what can only happen to a comment comes on top of GitHub's refusals. */
export type ReviewCommentFailure =
    | ReviewWriteFailure
    /** A comment meant for a draft that turned out not to be open. */
    | { readonly kind: 'noDraft' }
    /** A reply meant to go out at once, and a draft turned out to be open, which it would have joined: it wasn't sent. */
    | { readonly kind: 'draftFound' };

/** How far a comment box is. */
export type ReviewCommentStatus =
    | { readonly kind: 'editing' }
    | { readonly kind: 'failed'; readonly failure: ReviewCommentFailure }
    /** Shows as a comment at once (`AGENTS.md`), its text still kept until GitHub answers. */
    | { readonly kind: 'sending'; readonly way: ReviewCommentWay; readonly body: string }
    /** GitHub took it: it shows like this until the threads read again have it. */
    | { readonly kind: 'sent'; readonly way: ReviewCommentWay; readonly body: string };

/** What the submit dialog holds (D33). */
export interface ReviewSubmissionChoice {
    readonly event: PullRequestReviewEvent;
    /** The review's own text, on the pull request itself. */
    readonly body: string;
}

/** What finishes a review: `submit` goes with no draft open too, as a review with no comments (D33). */
export type ReviewFinish =
    | { readonly kind: 'submit'; readonly choice: ReviewSubmissionChoice }
    | { readonly kind: 'discard' };

/** Why finishing a review didn't go: what can only happen to a finish comes on top of GitHub's refusals. */
export type ReviewFinishFailure =
    | ReviewWriteFailure
    /** A comment queued ahead of a submit was refused: nothing was written, for the reader counted it in. */
    | { readonly kind: 'commentRefused' };

/** How finishing the draft is going; `failed` keeps everything, and `retry` sends the same again (D33, CR76). */
export type ReviewFinishState =
    | { readonly kind: 'idle' }
    | { readonly kind: 'sending'; readonly finish: ReviewFinish }
    | {
          readonly kind: 'failed';
          readonly finish: ReviewFinish;
          readonly failure: ReviewFinishFailure;
          /** The draft it was sent against, `null` for none: says whether the draft open now is one the reader has seen. */
          readonly draftId: string | null;
      };

/**
 * What is being written in a pull request's review: its comment boxes and its draft on the way to GitHub. Reactive, except
 * for its methods. {@link targets} changes only when a box comes, goes or moves, for rows are built of it, and a key press
 * changes only {@link getText}.
 */
export interface ReviewWriting {
    /** The boxes open, oldest first. */
    readonly targets: readonly ReviewCommentTarget[];
    /** Whether any box holds text not sent: the tab doesn't reload under it. */
    readonly hasText: boolean;
    /** Whether a comment can only join a draft: one is open, or one on its way starts it. */
    readonly draftOpen: boolean;
    /** How many comments the draft has, those on their way to it too. */
    readonly draftCount: number;
    readonly finish: ReviewFinishState;
    /** A failure can be sent again unless a different draft is open now, which that would submit unseen. */
    readonly canRetry: boolean;
    /** A failure can be put away unless the draft it was sent against is still open, which it still stands in the way of. */
    readonly canDismiss: boolean;
    readonly submission: ReviewSubmissionChoice;
    setSubmission(choice: ReviewSubmissionChoice): void;
    /** A box on the line: the one being written there, or a new one. */
    open(target: Omit<ReviewCommentTarget, 'id'>): ReviewCommentTarget;
    /** The box now covers those lines, keeping its text. */
    setRange(id: string, startLine: number | null, line: number): void;
    /** Closes a box, its text gone with it. */
    close(id: string): void;
    getText(id: string): string;
    /** Kept on disk at once: what is typed survives a reload. */
    setText(id: string, text: string): void;
    getStatus(id: string): ReviewCommentStatus;
    /** Sends what the box holds, once: nothing for an empty box or one already on its way. */
    send(id: string, way: ReviewCommentWay): void;
    /** Submits the draft as chosen, or with none open a review with no comments. */
    submit(choice: ReviewSubmissionChoice): void;
    /** Deletes the draft on GitHub. */
    discard(): void;
    /** Sends again what failed, while {@link canRetry}. */
    retry(): void;
    /** Puts the failure away, while {@link canDismiss}, keeping the choice for the dialog. */
    dismiss(): void;
    /** Resolves a thread, or opens it again: shows at once, at once on GitHub whatever draft is open (D17). */
    setResolved(threadId: string, resolved: boolean): void;
    /** Why the last change of the thread's state didn't go through; it shows as it was again. */
    getResolveFailure(threadId: string): ReviewWriteFailure | null;
}

/** The submit dialog before anything is chosen, and the second key's review (D22): a comment, with no text of its own. */
export const NO_REVIEW_SUBMISSION: ReviewSubmissionChoice = { event: 'COMMENT', body: '' };

/** Nothing is finishing a draft. */
export const REVIEW_FINISH_IDLE: ReviewFinishState = { kind: 'idle' };
