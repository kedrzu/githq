import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';

/** A pull request's writing with nothing being written, for a review's stories and tests that build their files by hand. */
export const idleReviewWriting: ReviewWriting = {
    targets: [],
    hasText: false,
    draftOpen: false,
    draftCount: 0,
    finish: { kind: 'idle' },
    submission: { event: 'COMMENT', body: '' },
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
};
