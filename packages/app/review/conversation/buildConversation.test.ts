import { expect, test } from 'bun:test';

import type { ItemComment, ItemReviewSummary } from '@/store/ItemDetailTypes.js';

import { buildConversation } from './buildConversation.js';

const NO_THREADS = new Map();

test('comments and summaries go in one time order, newest last, however they were read', () => {
    const entries = buildConversation({
        comments: [comment('C_1', '2026-10-30T10:00:00Z'), comment('C_2', '2026-10-30T14:00:00Z')],
        summaries: [review('R_1', '2026-10-30T12:00:00Z'), review('R_2', '2026-10-30T09:00:00Z')],
        threads: NO_THREADS,
    });

    expect(entries.map(entry => entry.id)).toEqual(['R_2', 'C_1', 'R_1', 'C_2']);
});

test('a reply, a review with no text, verdict or thread of its own, is left out; any of those keeps it', () => {
    const entries = buildConversation({
        comments: [],
        summaries: [
            review('reply', '2026-10-30T10:00:00Z', { state: 'COMMENTED', bodyHtml: '' }),
            review('text', '2026-10-30T10:00:01Z', { state: 'COMMENTED' }),
            review('verdict', '2026-10-30T10:00:02Z', { state: 'APPROVED', bodyHtml: '' }),
            review('threads', '2026-10-30T10:00:03Z', { state: 'COMMENTED', bodyHtml: '' }),
        ],
        threads: new Map([['threads', { ids: new Set(['T_1']), resolved: false, paths: ['src/a.ts'] }]]),
    });

    expect(entries.map(entry => entry.id)).toEqual(['text', 'verdict', 'threads']);
});

test('the user’s comments on their way come after everything GitHub told, then those GitHub did not take', () => {
    const entries = buildConversation({
        comments: [
            { ...comment('C_1', '2026-10-30T10:00:00Z'), pendingBody: 'typed' },
            comment('C_2', '2026-10-30T11:00:00Z'),
        ],
        summaries: [review('R_1', '2026-10-30T12:00:00Z')],
        threads: NO_THREADS,
        failedComments: [{ id: 7, itemId: 'PR_1', body: 'refused', reason: { kind: 'offline' }, retrying: false }],
    });

    expect(entries.map(entry => entry.id)).toEqual(['C_2', 'R_1', 'C_1', 'failed:7']);
});

function comment(id: string, createdAt: string): ItemComment {
    return {
        id,
        url: '',
        author: null,
        body: 'text',
        bodyHtml: '<p>text</p>',
        createdAt,
        lastEditedAt: null,
        viewerCanUpdate: false,
        viewerCanDelete: false,
    };
}

function review(id: string, submittedAt: string, overrides: Partial<ItemReviewSummary> = {}): ItemReviewSummary {
    return {
        id,
        url: '',
        author: null,
        state: 'APPROVED',
        body: 'text',
        bodyHtml: '<p>text</p>',
        submittedAt,
        ...overrides,
    };
}
