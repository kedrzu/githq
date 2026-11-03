/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { TestGraphQLAnswer } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { MergePanelStore } from './MergePanelStore.js';
import { PullRequestCommands } from './PullRequestCommands.js';

const QUEUE_ENTRY = {
    position: 1,
    state: 'QUEUED',
    estimatedTimeToMerge: null,
    enqueuedAt: '2026-11-03T10:00:00Z',
    enqueuer: 'someone',
} as const;

const MERGED: PullRequestItem = { ...samplePullRequest('PR_1'), state: 'MERGED', merged: true };

function member(id: string, position: number): PullRequestItem {
    return {
        ...samplePullRequest(id),
        stack: { id: 'S_1', number: 1, size: 2, position },
        mergeQueueEntry: { ...QUEUE_ENTRY, position },
    };
}

async function setup(rows: readonly PullRequestItem[], answers: Record<string, TestGraphQLAnswer>) {
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: request => answers[request.operation],
    });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    await items.ready();
    items.upsertMany([...rows]);
    return {
        commands: session.container.resolve(PullRequestCommands),
        store: session.container.resolve(MergePanelStore),
        session,
    };
}

function sent(session: ReturnType<typeof createTestSession>, operation: string) {
    return session.github.requests.filter(request => request.operation === operation).map(({ variables }) => variables);
}

test('⇧Q in a stack goes to its first open member, whichever one asked (D11)', async () => {
    const [first, later] = [member('PR_1', 1), member('PR_2', 2)];
    const { commands, session } = await setup([first, later], {
        DequeuePullRequest: { data: { dequeuePullRequest: { clientMutationId: null } } },
    });

    const taken = await commands.run(later, { kind: 'dequeue' });

    expect(taken).toBe(true);
    expect(sent(session, 'DequeuePullRequest')).toEqual([{ id: 'PR_1' }]);
});

test('reverting says where the new pull request is, for its toast, and on the pull request named', async () => {
    const { commands, store, session } = await setup([MERGED], {
        RevertPullRequest: {
            data: { revertPullRequest: { revertPullRequest: { number: 59, url: 'https://github.com/a/b/pull/59' } } },
        },
    });

    const reverted = await commands.run(MERGED, { kind: 'revert' });

    expect(reverted).toBe(true);
    expect(sent(session, 'RevertPullRequest')).toEqual([{ pullRequestId: 'PR_1' }]);
    expect(store.reverts).toEqual([
        expect.objectContaining({
            reference: `${MERGED.repository.nameWithOwner}#${MERGED.number}`,
            opened: { number: 59, url: 'https://github.com/a/b/pull/59' },
        }),
    ]);
});

test('a second press of ⇧Z while the first is on its way opens no second pull request', async () => {
    const { commands, session } = await setup([MERGED], {
        RevertPullRequest: {
            data: { revertPullRequest: { revertPullRequest: { number: 59, url: 'https://github.com/a/b/pull/59' } } },
        },
    });

    const [first, second] = await Promise.all([
        commands.run(MERGED, { kind: 'revert' }),
        commands.run(MERGED, { kind: 'revert' }),
    ]);

    expect([first, second]).toEqual([true, false]);
    expect(sent(session, 'RevertPullRequest')).toHaveLength(1);
});

test('a revert GitHub refuses is a failed edit: no toast of a new pull request', async () => {
    const { commands, store } = await setup([MERGED], {
        RevertPullRequest: {
            data: { revertPullRequest: null },
            errors: [{ type: 'UNPROCESSABLE', message: 'Revert has conflicts.' }],
        },
    });

    expect(await commands.run(MERGED, { kind: 'revert' })).toBe(false);
    expect(store.reverts).toEqual([]);
});
