import { NO_REVIEW_SUBMISSION, REVIEW_FINISH_IDLE } from '@/review/writing/ReviewWriting.js';
import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';

/** A pull request's writing with nothing being written, for a review's stories and tests that build their files by hand. */
export const idleReviewWriting: ReviewWriting = {
    targets: [],
    hasText: false,
    draftOpen: false,
    draftCount: 0,
    finish: REVIEW_FINISH_IDLE,
    canRetry: false,
    canDismiss: false,
    submission: NO_REVIEW_SUBMISSION,
    setSubmission: () => {},
    open: target => ({ ...target, id: 'box' }),
    setRange: () => {},
    close: () => {},
    getText: () => '',
    setText: () => {},
    getStatus: () => ({ kind: 'editing' }),
    send: () => {},
    submit: () => {},
    discard: () => {},
    retry: () => {},
    dismiss: () => {},
    setResolved: () => {},
    getResolveFailure: () => null,
};
