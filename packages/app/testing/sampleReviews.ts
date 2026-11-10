import type { ThreadCodeComment, ThreadPendingReview, ThreadReview } from '@/item/thread/buildThread.js';
import type { ReviewThread, ReviewThreadComment } from '@/review/threads/ReviewThread.js';
import type { ItemReviewSummary } from '@/store/ItemDetailTypes.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import { SAMPLE_NOW, sampleUser } from './sampleMyWork.js';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** The pull request's author, who is signed in on these screens (F14's "ML"). */
export const REVIEW_VIEWER: ItemUser = sampleUser('mlaine', '#c9a26b');
const SOFIAB = sampleUser('sofiab', '#7fb3d5');
const DKIM = sampleUser('dkim', '#8fbf9f');

/** The code F14's threads on `src/store/db.ts` were written on. */
const DB_HUNK = [
    '@@ -41,3 +41,3 @@',
    "     const tx = db.transaction(['issues'], 'readwrite')",
    "-    await tx.objectStore('pulls').clear()",
    '+    await migratePulls(tx, { keepCrossRepo: true })',
    '     await tx.done',
].join('\n');

const SCHEMA_HUNK = [
    '@@ -8,3 +8,3 @@',
    " export const STORES = ['issues', 'pulls'] as const",
    '-export const VERSION = 3',
    '+export const VERSION = 4',
    ' ',
].join('\n');

/** sofiab's open thread on `src/store/db.ts`, mlaine answered. */
export const DB_THREAD: ReviewThread = sampleReviewThread({
    id: 'T_db',
    path: 'src/store/db.ts',
    hunk: DB_HUNK,
    lines: [41, 43],
    comments: [
        [
            SOFIAB,
            '<p>Clearing the pulls store drops every pull request whose base lives in another repository. That’s what the e2e trips on.</p>',
            2 * HOUR,
            'R_sofiab',
        ],
        [REVIEW_VIEWER, '<p>Right, migrating now instead of clearing. Pushed in e81f0a3.</p>', HOUR, 'R_reply'],
    ],
});

/** dkim's thread on `src/store/schema.ts`, resolved by mlaine. */
export const SCHEMA_THREAD: ReviewThread = sampleReviewThread({
    id: 'T_schema',
    path: 'src/store/schema.ts',
    hunk: SCHEMA_HUNK,
    lines: [8, 10],
    comments: [
        [
            DKIM,
            '<p>Nit: the version could live next to the stores, so a new store can’t forget to bump it.</p>',
            2 * DAY,
            'R_dkim',
        ],
        [REVIEW_VIEWER, '<p>Moved it in 0c94d7e.</p>', 2 * DAY - HOUR, 'R_reply'],
    ],
    isResolved: true,
    resolvedBy: REVIEW_VIEWER,
});

/** dkim's question on `src/store/db.ts` (`Activity / Review · commented`). */
export const OPTION_THREAD: ReviewThread = sampleReviewThread({
    id: 'T_option',
    path: 'src/store/db.ts',
    hunk: DB_HUNK,
    lines: [41, 43],
    comments: [
        [DKIM, '<p>keepCrossRepo reads like an option. Is there a case where it should be false?</p>', DAY, 'R_dkim'],
        [REVIEW_VIEWER, '<p>Only the tests turn it off. I’ll make it the default.</p>', DAY - HOUR, 'R_reply'],
    ],
});

/** The viewer's own comment in their draft review. */
export const DRAFT_THREAD: ReviewThread = sampleReviewThread({
    id: 'T_draft',
    path: 'src/store/db.ts',
    hunk: DB_HUNK,
    lines: [41, 43],
    comments: [
        [
            REVIEW_VIEWER,
            '<p>Nit: the name hides that this runs once per upgrade, not on every open.</p>',
            0,
            'R_draft',
            'PENDING',
        ],
    ],
});

/** sofiab requested changes: one thread open, one resolved (`Activity / Review`). */
export const CHANGES_REQUESTED_REVIEW: ThreadReview = sampleReview({
    summary: sampleSummary({
        id: 'R_sofiab',
        author: SOFIAB,
        state: 'CHANGES_REQUESTED',
        ago: 2 * DAY,
        text: 'The upgrade path loses data in one case, see the thread. The rest reads well.',
    }),
    threads: [DB_THREAD],
    resolved: [SCHEMA_THREAD],
});

/** dkim approved, with a summary and no threads. */
export const APPROVED_REVIEW: ThreadReview = sampleReview({
    summary: sampleSummary({
        id: 'R_approved',
        author: DKIM,
        state: 'APPROVED',
        ago: 2 * HOUR,
        text: 'The migration reads well now, and the e2e covers the case that bit us.',
    }),
});

/** dkim commented: a summary and one thread. */
export const COMMENTED_REVIEW: ThreadReview = sampleReview({
    summary: sampleSummary({
        id: 'R_dkim',
        author: DKIM,
        state: 'COMMENTED',
        ago: DAY,
        text: 'Two small things, neither blocking.',
    }),
    threads: [OPTION_THREAD],
});

/** The same review with no summary. */
export const COMMENTED_NO_SUMMARY_REVIEW: ThreadReview = sampleReview({
    summary: sampleSummary({ id: 'R_dkim', author: DKIM, state: 'COMMENTED', ago: DAY, text: null }),
    threads: [OPTION_THREAD],
});

/** sofiab's review dismissed: it had requested changes. */
export const DISMISSED_REVIEW: ThreadReview = {
    ...CHANGES_REQUESTED_REVIEW,
    review: { ...CHANGES_REQUESTED_REVIEW.review, state: 'DISMISSED' },
    dismissedFrom: 'CHANGES_REQUESTED',
};

/** dkim's comment on the code posted on its own, resolved since. */
export const RESOLVED_CODE_COMMENT: ThreadCodeComment = {
    kind: 'codeComment',
    id: SCHEMA_THREAD.id,
    thread: SCHEMA_THREAD,
};

/** The viewer's draft review: one comment, on a thread of its own. */
export const PENDING_REVIEW: ThreadPendingReview = {
    kind: 'pendingReview',
    id: 'pendingReview',
    review: { id: 'R_draft', commentCount: 1, createdAt: new Date(SAMPLE_NOW).toISOString() },
    threads: [DRAFT_THREAD],
};

/** What {@link sampleReviewThread} makes a thread of. */
interface SampleReviewThreadParams {
    readonly id: string;
    readonly path: string;
    readonly hunk: string;
    /** Its first and last line. */
    readonly lines: readonly [number, number];
    /** Who, what, how long before `SAMPLE_NOW`, in which review, and `PENDING` in a draft. */
    readonly comments: readonly (readonly [ItemUser, string, number, string, ReviewThreadComment['state']?])[];
    readonly isResolved?: boolean;
    readonly resolvedBy?: ItemUser;
}

/** A review thread on F14's code. */
export function sampleReviewThread(params: SampleReviewThreadParams): ReviewThread {
    const [start, end] = params.lines;
    return {
        id: params.id,
        path: params.path,
        line: end,
        startLine: start,
        originalLine: end,
        originalStartLine: start,
        diffSide: 'RIGHT',
        startDiffSide: 'RIGHT',
        isOutdated: false,
        isResolved: params.isResolved ?? false,
        subjectType: 'LINE',
        viewerCanReply: true,
        viewerCanResolve: true,
        viewerCanUnresolve: true,
        resolvedBy: params.resolvedBy ?? null,
        comments: params.comments.map(([author, bodyHTML, ago, reviewId, state = 'SUBMITTED'], index) => ({
            id: `${params.id}_${index}`,
            author,
            bodyHTML,
            createdAt: new Date(SAMPLE_NOW - ago).toISOString(),
            url: `https://github.com/mlaine/tasklet/pull/15#discussion_${params.id}_${index}`,
            diffHunk: params.hunk,
            outdated: false,
            state,
            originalCommit: { oid: 'e81f0a3d5c1b9f7a', abbreviatedOid: 'e81f0a3' },
            pullRequestReview: { id: reviewId },
        })),
    };
}

/** What {@link sampleReview} makes a review item of. */
interface SampleReviewParams {
    readonly summary: ItemReviewSummary;
    readonly threads?: readonly ReviewThread[];
    readonly resolved?: readonly ReviewThread[];
}

function sampleReview({ summary, threads = [], resolved = [] }: SampleReviewParams): ThreadReview {
    return { kind: 'review', id: summary.id, review: summary, threads, resolved, dismissedFrom: null };
}

/** What {@link sampleSummary} makes a review of. */
interface SampleSummaryParams {
    readonly id: string;
    readonly author: ItemUser;
    readonly state: ItemReviewSummary['state'];
    /** How long before `SAMPLE_NOW` it was submitted. */
    readonly ago: number;
    /** Its summary; `null` for none. */
    readonly text: string | null;
}

function sampleSummary({ id, author, state, ago, text }: SampleSummaryParams): ItemReviewSummary {
    return {
        id,
        url: `https://github.com/mlaine/tasklet/pull/15#pullrequestreview-${id}`,
        author,
        state,
        bodyHtml: text === null ? '' : `<p>${text}</p>`,
        submittedAt: new Date(SAMPLE_NOW - ago).toISOString(),
    };
}
