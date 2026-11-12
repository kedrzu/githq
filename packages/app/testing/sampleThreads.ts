import type { ReviewThreadRow } from '@/review/buildReviewRows.js';
import type { ThreadPlacement } from '@/review/threads/placeThreads.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';

/** A thread of two comments, for stories. */
export function sampleThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
    return {
        id: 'T_1',
        path: 'src/sync/engine.ts',
        line: 47,
        startLine: null,
        originalLine: 47,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        viewerCanReply: true,
        viewerCanResolve: true,
        viewerCanUnresolve: true,
        resolvedBy: null,
        comments: [
            {
                id: 'C_1',
                author: { login: 'sofiab', avatarUrl: '' },
                bodyHTML:
                    '<p>What happens when the same workout is edited twice? See <a href="https://example.com/docs">the docs</a>.</p>',
                createdAt: '2026-10-30T12:00:00Z',
                url: 'https://github.com/fitloop/webapp/pull/1202#discussion_r1',
                diffHunk: '@@ -46,2 +46,2 @@\n one\n+two',
                outdated: false,
                state: 'SUBMITTED',
                originalCommit: { oid: 'a91d03b0', abbreviatedOid: 'a91d03b' },
                pullRequestReview: { id: 'PRR_1' },
            },
            {
                id: 'C_2',
                author: null,
                bodyHTML: '<p>Both are kept on purpose.</p>',
                createdAt: '2026-10-30T13:00:00Z',
                url: 'https://github.com/fitloop/webapp/pull/1202#discussion_r2',
                diffHunk: '@@ -46,2 +46,2 @@\n one\n+two',
                outdated: false,
                state: 'SUBMITTED',
                originalCommit: { oid: 'a91d03b0', abbreviatedOid: 'a91d03b' },
                pullRequestReview: { id: 'PRR_1' },
            },
        ],
        ...overrides,
    };
}

/** What {@link createThreadRowSample} makes a row of. */
export type ThreadRowSample =
    | {
          readonly kind: 'onLine';
          readonly inline: NonNullable<ReviewThreadRow['inline']>;
          readonly approximate?: boolean;
          readonly thread?: ReviewThread;
      }
    | {
          readonly kind: 'fileTop';
          readonly diffHunk: string;
          readonly commit?: ThreadCommit;
          readonly fileDeleted?: boolean;
          readonly thread?: ReviewThread;
      }
    | {
          readonly kind: 'inCollapsed';
          readonly diffHunk: string;
          readonly notLoaded?: boolean;
          readonly thread?: ReviewThread;
      }
    | { readonly kind: 'gone'; readonly diffHunk: string; readonly thread?: ReviewThread };

type ThreadCommit = Extract<ThreadPlacement, { kind: 'fileTop' }>['commit'];

/** A thread's row where a story wants it. */
export function createThreadRowSample(sample: ThreadRowSample): ReviewThreadRow {
    const thread = sample.thread ?? sampleThread();
    return {
        kind: 'thread',
        key: `thread ${thread.id}`,
        inline: sample.kind === 'onLine' ? sample.inline : null,
        placement: createPlacement(sample, thread),
        replies: [],
    };
}

function createPlacement(sample: ThreadRowSample, thread: ReviewThread): ThreadPlacement {
    switch (sample.kind) {
        case 'onLine':
            return {
                kind: 'onLine',
                thread,
                side: sample.inline === 'left' ? 'before' : 'after',
                line: 47,
                approximate: sample.approximate ?? false,
                rowKeys: { split: '47:47', unified: '47:47' },
            };
        case 'fileTop':
            return {
                kind: 'fileTop',
                thread,
                diffHunk: sample.diffHunk,
                commit: sample.commit ?? null,
                fileDeleted: sample.fileDeleted ?? false,
            };
        case 'inCollapsed':
            return { kind: 'inCollapsed', thread, diffHunk: sample.diffHunk, notLoaded: sample.notLoaded ?? false };
        default:
            return { kind: 'gone', thread, diffHunk: sample.diffHunk };
    }
}
