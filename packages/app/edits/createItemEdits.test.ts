/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { describe, expect, test } from 'bun:test';

import type { UpdatePullRequestBranchMutation } from '@githq/github/generated.gen.js';

import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, PullRequestQueueEntry } from '@/store/ItemTypes.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { samplePullRequestNode as sampleRowNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { ItemEditor } from './ItemEditor.js';

test('PM20: updating the branch names the head the user saw — GitHub refuses it once the branch moved', async () => {
    const { editor, session } = await setup(null);

    const outcome = await editor.edit(['PR_1'], { kind: 'updateBranch', method: 'MERGE' });

    expect(outcome.failed).toEqual([]);
    expect(session.github.requests.filter(request => request.operation === 'UpdatePullRequestBranch')).toEqual([
        expect.objectContaining({
            variables: { pullRequestId: 'PR_1', expectedHeadOid: 'seen-head', updateMethod: 'MERGE' },
        }),
    ]);
});

test('PM20: an update GitHub refuses is a failed edit like any other, with its reason', async () => {
    const { editor, items } = await setup('Expected head sha did not match current head ref.');

    const outcome = await editor.edit(['PR_1'], { kind: 'updateBranch', method: 'MERGE' });

    expect(outcome.failed.map(({ edit, reason }) => ({ subject: edit.subject, reason }))).toEqual([
        {
            subject: { kind: 'branchUpdated' },
            reason: { kind: 'refused', message: 'Expected head sha did not match current head ref.' },
        },
    ]);
    expect(items.get('PR_1')).toMatchObject({ headRefOid: 'seen-head', mergeStateStatus: 'BEHIND' });
});

const AUTO_MERGE_ON = { mergeMethod: 'SQUASH', enabledAt: null, enabledBy: null, commitHeadline: null } as const;
const QUEUE_ENTRY = {
    position: 1,
    state: 'QUEUED',
    estimatedTimeToMerge: null,
    enqueuedAt: '2026-11-03T00:00:00Z',
    enqueuer: 'mlaine',
    jump: true,
} as const;

test('PM10: auto-merge goes on with the method and the head the user saw, the text only when edited; it shows at once', async () => {
    const { drawn, editor, items, session } = await setupMerge({
        enablePullRequestAutoMerge: {
            pullRequest: sampleStatus({
                autoMergeRequest: { ...AUTO_MERGE_ON, enabledBy: { login: 'mlaine' } },
            }),
        },
    });

    const outcome = await editor.edit(['PR_1'], { kind: 'enableAutoMerge', method: 'SQUASH' });

    expect(outcome.failed).toEqual([]);
    expect(drawn()).toMatchObject({ autoMerge: { mergeMethod: 'SQUASH' } });
    expect(requests(session, 'EnablePullRequestAutoMerge')).toEqual([
        { pullRequestId: 'PR_1', mergeMethod: 'SQUASH', expectedHeadOid: 'seen-head' },
    ]);
    expect(items.get('PR_1')).toMatchObject({ autoMerge: { enabledBy: 'mlaine' } });
});

test('PM10: an edited title goes, and nothing of the body not edited', async () => {
    const { editor, session } = await setupMerge({
        enablePullRequestAutoMerge: { pullRequest: sampleStatus({ autoMergeRequest: AUTO_MERGE_ON }) },
    });

    await editor.edit(['PR_1'], { kind: 'enableAutoMerge', method: 'MERGE', title: 'A title' });

    expect(requests(session, 'EnablePullRequestAutoMerge')).toEqual([
        { pullRequestId: 'PR_1', mergeMethod: 'MERGE', expectedHeadOid: 'seen-head', commitHeadline: 'A title' },
    ]);
});

test('never auto-merge on a stacked pull request: nothing is sent', async () => {
    const { editor, items, session } = await setupMerge({});
    items.upsertMany([
        { ...samplePullRequest('PR_1'), headRefOid: 'seen-head', stack: { id: 'S', number: 1, size: 2, position: 1 } },
    ]);

    await editor.edit(['PR_1'], { kind: 'enableAutoMerge', method: 'SQUASH' });

    expect(requests(session, 'EnablePullRequestAutoMerge')).toEqual([]);
});

test('PM10: GitHub refusing it is a failed edit, and the pull request reads as it did', async () => {
    const { editor, items } = await setupMerge(
        { enablePullRequestAutoMerge: null },
        'Auto-merge is not supported for stacked pull requests.',
    );

    const outcome = await editor.edit(['PR_1'], { kind: 'enableAutoMerge', method: 'SQUASH' });

    expect(outcome.failed.map(({ edit }) => edit.subject)).toEqual([{ kind: 'autoMerge', enabled: true }]);
    expect(items.get('PR_1')).toMatchObject({ autoMerge: null });
});

test('PM11: turning auto-merge off reads off at once and stays', async () => {
    const { editor, items, session } = await setupMerge({
        disablePullRequestAutoMerge: { pullRequest: sampleStatus({ autoMergeRequest: null }) },
    });
    items.upsertMany([{ ...samplePullRequest('PR_1'), autoMerge: { ...AUTO_MERGE_ON, enabledBy: 'mlaine' } }]);

    const outcome = await editor.edit(['PR_1'], { kind: 'disableAutoMerge' });

    expect(outcome.failed).toEqual([]);
    expect(requests(session, 'DisablePullRequestAutoMerge')).toEqual([{ pullRequestId: 'PR_1' }]);
    expect(items.get('PR_1')).toMatchObject({ autoMerge: null });
});

test('PM14: jumping asks for it by jump: true with the head the user saw, and reads the place GitHub gives', async () => {
    const { editor, items, session } = await setupMerge({
        enqueuePullRequest: {
            mergeQueueEntry: {
                pullRequest: sampleStatus({ mergeQueueEntry: { ...QUEUE_ENTRY, enqueuer: { login: 'mlaine' } } }),
            },
        },
    });

    const outcome = await editor.edit(['PR_1'], { kind: 'jumpQueue' });

    expect(outcome.failed).toEqual([]);
    expect(requests(session, 'EnqueuePullRequest')).toEqual([
        { pullRequestId: 'PR_1', expectedHeadOid: 'seen-head', jump: true },
    ]);
    expect(items.get('PR_1')).toMatchObject({ mergeQueueEntry: { position: 1, jump: true } });
});

test('PM15: taking it out of the queue reads out of it at once, and stays as GitHub holds it read again — its answer may still say the old state', async () => {
    const { editor, items, session } = await setupMerge({ dequeuePullRequest: { clientMutationId: null } }, null, {
        nodes: [sampleStatus({ mergeQueueEntry: null })],
    });
    items.upsertMany([{ ...samplePullRequest('PR_1'), mergeQueueEntry: toEntry() }]);

    const outcome = await editor.edit(['PR_1'], { kind: 'dequeue' });

    expect(outcome.failed).toEqual([]);
    expect(requests(session, 'DequeuePullRequest')).toEqual([{ id: 'PR_1' }]);
    expect(requests(session, 'PullRequestStatuses')).toEqual([{ ids: ['PR_1'] }]);
    expect(items.get('PR_1')).toMatchObject({ mergeQueueEntry: null });
});

test('PM15: not read again, it is left to the next sync, with no failure', async () => {
    const { editor, items } = await setupMerge({ dequeuePullRequest: { clientMutationId: null } });
    items.upsertMany([{ ...samplePullRequest('PR_1'), mergeQueueEntry: toEntry() }]);

    const outcome = await editor.edit(['PR_1'], { kind: 'dequeue' });

    expect(outcome.failed).toEqual([]);
});

test('PM15: read again still in the queue, it is a failed edit', async () => {
    const { editor, items } = await setupMerge({ dequeuePullRequest: { clientMutationId: null } }, null, {
        nodes: [sampleStatus({ mergeQueueEntry: { ...QUEUE_ENTRY, enqueuer: { login: 'mlaine' } } })],
    });
    items.upsertMany([{ ...samplePullRequest('PR_1'), mergeQueueEntry: toEntry() }]);

    const outcome = await editor.edit(['PR_1'], { kind: 'dequeue' });

    expect(outcome.failed.map(({ reason }) => reason)).toEqual([{ kind: 'dropped' }]);
    expect(items.get('PR_1')).toMatchObject({ mergeQueueEntry: { position: 1 } });
});

describe('a stack in the queue', () => {
    /** #0 merged, #1 first queued, #2 the top: as the copy holds it, in the copy's order. */
    function queuedStack() {
        const stack = { id: 'S_1', number: 1, size: 3 };
        return [
            {
                ...samplePullRequest('PR_2'),
                stack: { ...stack, position: 3 },
                mergeQueueEntry: { ...toEntry(), position: 2 },
            },
            { ...samplePullRequest('PR_1'), stack: { ...stack, position: 2 }, mergeQueueEntry: toEntry() },
            { ...samplePullRequest('PR_0'), stack: { ...stack, position: 1 }, state: 'MERGED', merged: true } as const,
        ];
    }

    test('SP54: from any member it goes once, to the first queued; every member reads what GitHub holds', async () => {
        const { editor, items, session } = await setupMerge({ dequeuePullRequest: { clientMutationId: null } }, null, {
            nodes: [
                sampleStatus({ id: 'PR_1', mergeQueueEntry: null }),
                sampleStatus({ id: 'PR_2', mergeQueueEntry: null }),
            ],
        });
        items.upsertMany(queuedStack());

        const outcome = await editor.edit(['PR_2'], { kind: 'dequeue' });

        expect(outcome.failed).toEqual([]);
        expect(requests(session, 'DequeuePullRequest')).toEqual([{ id: 'PR_1' }]);
        expect(requests(session, 'PullRequestStatuses')).toEqual([{ ids: ['PR_1', 'PR_2'] }]);
        expect(items.get('PR_1')).toMatchObject({ mergeQueueEntry: null });
        expect(items.get('PR_2')).toMatchObject({ mergeQueueEntry: null });
    });

    test('SP54: refused, it is one failure, of the first queued, and every member is back in the queue', async () => {
        const { editor, items } = await setupMerge({ dequeuePullRequest: null }, 'No merge queue found');
        items.upsertMany(queuedStack());

        const outcome = await editor.edit(['PR_2'], { kind: 'dequeue' });

        expect(outcome.failed.map(({ edit }) => edit.itemId)).toEqual(['PR_1']);
        expect(items.get('PR_1')).toMatchObject({ mergeQueueEntry: { position: 1 } });
        expect(items.get('PR_2')).toMatchObject({ mergeQueueEntry: { position: 2 } });
    });
});

function toEntry(): PullRequestQueueEntry {
    return { ...QUEUE_ENTRY, enqueuer: 'mlaine' };
}

/** The status fields GitHub answers, its update time later than the row's. */
function sampleStatus(fields: Record<string, unknown>) {
    return {
        ...sampleRowNode('PR_1', { repository: 'acme/web', number: 1, updatedAt: '2026-01-01T00:00:00Z' }),
        updatedAt: '2030-01-01T00:00:00Z',
        ...fields,
    };
}

function requests(session: ReturnType<typeof createTestSession>, operation: string) {
    return session.github.requests.filter(request => request.operation === operation).map(({ variables }) => variables);
}

/** A pull request with its head as the user saw it; GitHub answers each mutation with `data`, or refuses with `refusal`. */
async function setupMerge(data: object, refusal: string | null = null, statuses: object | null = null) {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const editor = session.container.resolve(ItemEditor);
    await items.ready();
    items.upsertMany([{ ...samplePullRequest('PR_1'), headRefOid: 'seen-head' }]);

    let drawnWhenSent: Item | undefined;

    return { drawn: () => drawnWhenSent, editor, items, session };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (request.operation === 'PullRequestStatuses' && statuses) {
            return { data: statuses };
        }

        if (!/AutoMerge|queuePullRequest/iu.test(request.operation)) {
            return undefined;
        }

        drawnWhenSent = session.container.resolve(ItemDetailStore).getItem('PR_1');
        return refusal === null ? { data } : { data, errors: [{ type: 'UNPROCESSABLE', message: refusal }] };
    }
}

/** A pull request behind its base, as the user saw it; GitHub refuses the update with `refusal` when given. */
async function setup(refusal: string | null) {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const editor = session.container.resolve(ItemEditor);
    await items.ready();
    items.upsertMany([{ ...samplePullRequest('PR_1'), headRefOid: 'seen-head', mergeStateStatus: 'BEHIND' }]);

    return { editor, items, session };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (request.operation !== 'UpdatePullRequestBranch') {
            return undefined;
        }

        if (refusal !== null) {
            return { data: { updatePullRequestBranch: null }, errors: [{ type: 'UNPROCESSABLE', message: refusal }] };
        }

        const data: UpdatePullRequestBranchMutation = { updatePullRequestBranch: { pullRequest: { id: 'PR_1' } } };
        return { data };
    }
}
