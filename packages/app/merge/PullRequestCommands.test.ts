/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { TestGraphQLAnswer, TestRestAnswer } from '@/testing/createTestSession.js';
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

const BEHIND: PullRequestItem = { ...samplePullRequest('PR_1'), mergeStateStatus: 'BEHIND' };
const UPDATED: TestGraphQLAnswer = {
    data: { updatePullRequestBranch: { pullRequest: { id: 'PR_1' } } },
};
/** Longer than an update's head is waited for. */
const PAST_THE_WAIT_MS = 31_000;

async function setup(
    rows: readonly PullRequestItem[],
    answers: Record<string, TestGraphQLAnswer>,
    answerRest?: () => TestRestAnswer,
) {
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: request => answers[request.operation],
        answerRest,
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

test('U and ⇧U are one update: none is sent while one is on its way, and until its head moved, then it may be', async () => {
    const { commands, session } = await setup([BEHIND], { UpdatePullRequestBranch: UPDATED });

    const first = commands.run(BEHIND, { kind: 'updateBranch', method: 'MERGE' });
    expect(await commands.run(BEHIND, { kind: 'updateBranch', method: 'MERGE' })).toBe(false);

    // GitHub answered: waiting for the new head.
    await session.clock.advance(0);
    expect(sent(session, 'UpdatePullRequestBranch')).toHaveLength(1);
    expect(await commands.run(BEHIND, { kind: 'updateBranch', method: 'REBASE' })).toBe(false);
    expect(sent(session, 'UpdatePullRequestBranch')).toHaveLength(1);

    await session.clock.advance(PAST_THE_WAIT_MS);
    expect(await first).toBe(true);

    const again = commands.run(BEHIND, { kind: 'updateBranch', method: 'REBASE' });
    await session.clock.advance(PAST_THE_WAIT_MS);
    expect(await again).toBe(true);
    expect(sent(session, 'UpdatePullRequestBranch')).toHaveLength(2);
});

test('a second press of ⇧D while the first is on its way sends one; another command of it is not held back', async () => {
    const merged: PullRequestItem = { ...MERGED, headRefId: 'REF_1', viewerCanDeleteHeadRef: true };
    const { commands, session } = await setup([merged], {
        DeleteRef: { data: { deleteRef: { clientMutationId: null } } },
        RevertPullRequest: {
            data: { revertPullRequest: { revertPullRequest: { number: 59, url: 'https://github.com/a/b/pull/59' } } },
        },
    });

    const results = await Promise.all([
        commands.run(merged, { kind: 'deleteBranch' }),
        commands.run(merged, { kind: 'deleteBranch' }),
        commands.run(merged, { kind: 'revert' }),
    ]);

    expect(results).toEqual([true, false, true]);
    expect(sent(session, 'DeleteRef')).toHaveLength(1);
    expect(sent(session, 'RevertPullRequest')).toHaveLength(1);
});

test("updating from a stack's member ends the record of the stack's merge that took it, held under the top", async () => {
    const stack = { id: 'S_1', number: 1, size: 2 };
    const first: PullRequestItem = { ...BEHIND, stack: { ...stack, position: 1 } };
    const top: PullRequestItem = { ...samplePullRequest('PR_2'), stack: { ...stack, position: 2 } };
    const { commands, store, session } = await setup([first, top], { UpdatePullRequestBranch: UPDATED }, () => ({
        status: 405,
        body: { status: 'failed', details: { message: 'Required status check "ci" is expected.' } },
    }));
    store.open('PR_2', { wholeStack: true });
    const refused = store.merge({
        item: top,
        submission: { request: { method: 'SQUASH' }, edited: null },
        stack: { id: 'S_1', size: 2, going: [first, top] },
    });
    await session.clock.advance(0);
    await refused;
    expect(store.findRecordHolder('PR_1')).toBe('PR_2');

    const updating = commands.run(first, { kind: 'updateBranch', method: 'MERGE' });

    expect(store.findRecordHolder('PR_1')).toBeNull();
    await session.clock.advance(PAST_THE_WAIT_MS);
    await updating;
});

test('a revert GitHub answers once another account signed in leaves no toast there', async () => {
    const { commands, store, session } = await setup([MERGED], {
        RevertPullRequest: {
            data: { revertPullRequest: { revertPullRequest: { number: 59, url: 'https://github.com/a/b/pull/59' } } },
        },
    });
    const held = createPromise();
    session.github.hold = held.promise;

    const reverting = commands.run(MERGED, { kind: 'revert' });
    await session.clock.advance(0);
    session.signInFromAnotherTab(`user-${crypto.randomUUID()}`);
    await session.clock.advance(0);
    held.resolve();

    expect(await reverting).toBe(false);
    expect(store.reverts).toEqual([]);
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

test('PM29: U on a merge with no known end sends nothing, and it goes on saying so', async () => {
    const { commands, store, session } = await setup([BEHIND], { UpdatePullRequestBranch: UPDATED }, () => {
        throw new TypeError('Failed to fetch');
    });
    store.open('PR_1');
    const merging = store.merge({ item: BEHIND, submission: { request: { method: 'SQUASH' }, edited: null } });
    await session.clock.advance(0);
    await merging;
    expect(store.isOutcomeUnknown('PR_1')).toBe(true);

    expect(await commands.run(BEHIND, { kind: 'updateBranch', method: 'MERGE' })).toBe(false);

    expect(sent(session, 'UpdatePullRequestBranch')).toEqual([]);
    expect(store.isOutcomeUnknown('PR_1')).toBe(true);
});

test('⇧D twice is one: restore, which delete makes of the key, is held back while delete is on its way', async () => {
    const merged: PullRequestItem = { ...MERGED, headRefId: 'REF_1', viewerCanDeleteHeadRef: true };
    const { commands, session } = await setup([merged], {
        DeleteRef: { data: { deleteRef: { clientMutationId: null } } },
    });

    const results = await Promise.all([
        commands.run(merged, { kind: 'deleteBranch' }),
        commands.run(merged, { kind: 'restoreBranch' }),
    ]);

    expect(results).toEqual([true, false]);
    expect(sent(session, 'CreateRef')).toEqual([]);
});
