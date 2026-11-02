/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { PullRequestMergeOptionsQuery } from '@githq/github/generated.gen.js';

import { EditQueue } from '@/edits/EditQueue.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { SyncLoopState } from '@/store/ItemStoreTypes.js';
import type { TestGraphQLAnswer, TestRestAnswer } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequestDetailNode } from '@/testing/sampleDetailNodes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { samplePullRequestNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { MergePanelStore } from './MergePanelStore.js';
import type { MergeSubmission } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

const MERGE = 'PUT /repos/acme/web/pulls/2/merge-async';
const UUID = 'b904';
const MERGED: TestRestAnswer = { status: 200, body: { status: 'merged', details: { sha: 'merge-sha' } } };
const REFUSED: TestRestAnswer = {
    status: 405,
    body: { status: 'failed', details: { message: 'Required status check "ci" is expected.' } },
};
const PENDING: TestRestAnswer = { status: 202, body: { status: 'pending', details: { uuid: UUID } } };
const ENQUEUED: TestRestAnswer = { status: 202, body: { status: 'enqueued', details: {} } };
const STILL_PENDING: TestRestAnswer = { status: 200, body: { status: 'pending', details: { uuid: UUID } } };

/** The edited text, as the panel sends it: only the title differs from GitHub's. */
const EDITED: MergeSubmission = {
    request: { method: 'SQUASH', title: 'Edited' },
    edited: { title: 'Edited', body: 'Fix it' },
};
const SENT = { ...EDITED, head: 'head-oid' };
const REFUSAL = { kind: 'refused', message: 'Required status check "ci" is expected.' } as const;

/** A stack of two: #1, then the one the merge goes to (`PR_1`, #2). */
const STACK_TOP = { ...samplePullRequest('PR_1'), stack: { id: 'S_1', number: 1, size: 2, position: 2 } };
const STACK = [
    {
        ...samplePullRequest('PR_0'),
        number: 1,
        headRefOid: 'earlier-head',
        stack: { id: 'S_1', number: 1, size: 2, position: 1 },
    },
    STACK_TOP,
];

test('accepted: the panel leaves and the opener moves on; refused at once: it stays, nothing moves, nothing toasts', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);

    expect(await refused).toEqual({ kind: 'refused', reason: REFUSAL });
    expect(panel.itemId).toBe('PR_1');
    expect(sent).toEqual([]);
    expect(queue.failures).toEqual([]);

    answers.put = PENDING;
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);

    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(panel.itemId).toBeNull();
    expect(sent).toEqual(['PR_1']);
});

test('closed before GitHub answers: the opener does not move on, and a refusal is reported like a failed edit', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    // Put in the merge queue: accepted, and nothing more to follow.
    answers.put = ENQUEUED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const accepted = panel.merge({
        item: samplePullRequest('PR_1'),
        submission: { request: { method: 'MERGE' }, edited: null },
    });
    panel.close();
    await session.clock.advance(0);
    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(sent).toEqual([]);

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    // Opened for another pull request while this merge is on its way.
    panel.open('PR_9');
    await session.clock.advance(0);

    expect(await refused).toMatchObject({ kind: 'refused' });
    expect(panel.itemId).toBe('PR_9');
    expect(sent).toEqual([]);
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.reason))).toEqual([REFUSAL]);
});

test('PM25: a refusal is recorded as GitHub answers, with its reason and the edited text, and goes once the next merge is sent', async () => {
    const { panel, session, answers } = await setup();

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await refused;

    expect(panel.getRecord('PR_1')).toEqual({ kind: 'refused', sent: SENT, reason: REFUSAL, at: session.clock.now() });
    // Nothing is read to tell it apart: where it shows, the pull request as it is tells (`getMergeEnd`).
    expect(session.operations()).not.toContain('PullRequestMergeOptions');

    answers.put = MERGED;
    const merged = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    expect(panel.getRecord('PR_1')).toBeNull();
    await session.clock.advance(0);
    await merged;
    expect(panel.getRecord('PR_1')).toBeNull();
});

test('PM29: sent with no answer at all — it may have reached GitHub, so it is recorded as not known, never refused', async () => {
    const { panel, queue, session } = await setup();

    // The request never reaches GitHub, or its answer never comes back.
    session.github.holdIf = request =>
        request.operation === MERGE ? Promise.reject(new TypeError('Failed to fetch')) : null;
    panel.open('PR_1');
    const answering = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'refused', reason: { kind: 'offline' } });
    // Not accepted either: the panel says the request went unanswered, not that time ran out.
    expect(panel.getRecord('PR_1')).toEqual({ kind: 'unknown', sent: SENT, at: session.clock.now(), accepted: false });
    expect(panel.unanswered).toEqual(['PR_1']);
    expect(queue.failures).toEqual([]);
});

test('PM29, D15: no answer at all after the panel closed is grey too — no failed edit, no toast of a refusal', async () => {
    const { panel, queue, session } = await setup();

    session.github.holdIf = request =>
        request.operation === MERGE ? Promise.reject(new TypeError('Failed to fetch')) : null;
    panel.open('PR_1');
    const answering = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    panel.close();
    await session.clock.advance(0);
    await answering;

    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'unknown', accepted: false });
    expect(queue.failures).toEqual([]);
    expect(queue.undone.size).toBe(0);
});

test('PM30: merged at once — GitHub says so only for a pull request merged already: the panel stays, the opener does not move on, no toast', async () => {
    const { panel, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = MERGED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const merged = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);

    expect(await merged).toEqual({ kind: 'merged' });
    await session.clock.advance(1000);
    expect(panel.itemId).toBe('PR_1');
    expect(sent).toEqual([]);
    expect(panel.confirmations).toEqual([]);
    expect(panel.getRecord('PR_1')).toBeNull();
});

test('PM27, PM37: the head commit read after a refusal is noted on it while it is the head — for the rows to name who pushed it', async () => {
    const { panel, merger, session, answers } = await setup();
    const commit = { oid: 'new-head', headline: 'New', author: 'dkim' };

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await refused;

    // A commit that is not the head now is not noted.
    panel.noteHeadCommit('PR_1', commit);
    expect(panel.getRecord('PR_1')).not.toHaveProperty('headCommit');

    // The panel reads it again: the new head is written into the row, and its commit is noted.
    answers.optionsHead = 'new-head';
    await merger.readOptions('PR_1');
    panel.noteHeadCommit('PR_1', commit);
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'refused', headCommit: commit });
});

test('PM29: accepted, then no answer within the time limit — recorded as not known, with the text sent', async () => {
    const { panel, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(panel.getRecord('PR_1')).toBeNull();

    await session.clock.advance(120_000);
    expect(panel.getRecord('PR_1')).toEqual({ kind: 'unknown', sent: SENT, at: session.clock.now(), accepted: true });
});

test('PM36: no answer in time goes once a round of the regular sync started since succeeds — not a round started before, nor one failing', async () => {
    const { panel, queue, items, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await accepted;
    await session.clock.advance(120_000);
    const at = session.clock.now();
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'unknown' });
    expect(panel.unanswered).toEqual(['PR_1']);
    // Neither failed nor done: no toast of either.
    expect(queue.failures).toEqual([]);
    expect(panel.confirmations).toEqual([]);

    // A round that started before GitHub's silence may have read the pull request before it.
    items.setSyncState('pullRequestStatuses', syncRound(at - 1000, at + 1000));
    // One that started since and failed read nothing.
    items.setSyncState('myWork', syncRound(at + 1000, at + 2000, 'offline'));
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'unknown' });

    // The sync reads the open pull requests again: still open, it reads as GitHub says, free to merge again.
    items.setSyncState('pullRequestStatuses', syncRound(at + 3000, at + 4000));
    expect(panel.getRecord('PR_1')).toBeNull();
    expect(panel.unanswered).toEqual([]);

    // A round failing after it does not bring it back.
    items.setSyncState('pullRequestStatuses', syncRound(at + 5000, at + 6000, 'offline'));
    expect(panel.getRecord('PR_1')).toBeNull();
});

test('PM29: the panel’s own reads of the pull request do not settle no answer in time — only a copy read since does: its detail', async () => {
    const { panel, items, merger, details, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await accepted;
    await session.clock.advance(120_000);
    const synced = items.getStored('PR_1');

    // Opened again: the panel reads the merge options, twice over, and writes the status read into the row.
    panel.open('PR_1');
    await session.clock.advance(1000);
    await merger.readOptions('PR_1');
    await merger.readOptions('PR_1');
    expect(items.getStored('PR_1')).not.toBe(synced);
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'unknown' });

    // The opened item reads its detail: that settles it, and a read of the panel after it does not bring it back.
    await details.ensure('PR_1');
    expect(panel.getRecord('PR_1')).toBeNull();
    await merger.readOptions('PR_1');
    expect(panel.getRecord('PR_1')).toBeNull();
});

test('S1, D15: a copy read since ends what a refusal says too, but the method and text it was sent with stay for the session', async () => {
    const { panel, items, session, answers } = await setup();

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await refused;
    const at = session.clock.now();
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'refused' });

    items.setSyncState('myWork', syncRound(at + 1000, at + 2000));
    expect(panel.getRecord('PR_1')).toBeNull();
    expect(panel.getSent('PR_1')).toEqual(SENT);
});

test('PM20, PM21: a step the panel takes ends what the record says — its new head is no news of the merge — and keeps the text sent', async () => {
    const { panel, session, answers } = await setup();

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await refused;

    panel.forget('PR_1');
    expect(panel.getRecord('PR_1')).toBeNull();
    expect(panel.getSent('PR_1')).toEqual(SENT);
});

test('PM36: unanswered is told where it shows — a pull request read merged meanwhile is no longer unanswered', async () => {
    const { panel, items, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await accepted;
    await session.clock.advance(120_000);
    expect(panel.unanswered).toEqual(['PR_1']);

    items.upsertMany([
        { ...samplePullRequest('PR_1'), state: 'MERGED', merged: true, updatedAt: '2026-10-31T10:00:00Z' },
    ]);
    expect(panel.unanswered).toEqual([]);
});

test('PM34: a merge GitHub confirms after the panel left is listed for its toast, until dismissed', async () => {
    const { panel, session, answers } = await setup();

    // Merged while running, after the panel left.
    answers.put = PENDING;
    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await accepted;
    expect(panel.confirmations).toEqual([]);
    answers.read = MERGED;
    await session.clock.advance(1000);
    await session.clock.advance(0);

    expect(panel.confirmations).toEqual([{ id: 1, itemId: 'PR_1', reference: 'acme/web#2', base: 'main' }]);
    panel.dismissConfirmation(1);
    expect(panel.confirmations).toEqual([]);
});

test("PM24: a merge ending while the panel shows its pull request again is the panel's to say — no toast, no failed edit", async () => {
    const { panel, queue, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const first = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await first;
    // Back on it while it runs.
    panel.open('PR_1');

    answers.read = { status: 200, body: { status: 'failed', details: { message: REFUSAL.message } } };
    await session.clock.advance(1000);
    await session.clock.advance(0);

    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'refused', reason: REFUSAL });
    expect(queue.failures).toEqual([]);
});

test('refused while it ran, after the panel left: recorded as it arrives, with nothing read to tell it apart', async () => {
    const { panel, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await accepted;

    const message = 'Pull request head branch was modified.';
    answers.read = { status: 200, body: { status: 'failed', details: { message } } };
    await session.clock.advance(1000);
    await session.clock.advance(0);

    expect(panel.getRecord('PR_1')).toMatchObject({
        kind: 'refused',
        sent: SENT,
        reason: { kind: 'refused', message },
    });
    expect(session.operations()).not.toContain('PullRequestMergeOptions');
});

test('the records live in memory only: another account starts with none, and a reload with none', async () => {
    const { panel, session, answers, login } = await setup();
    answers.put = REFUSED;

    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED });
    await session.clock.advance(0);
    await refused;
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'refused' });

    // A reload: the same browser's storage, a new app.
    const reloaded = createTestSession({ login: null, answer: () => undefined, localStorage: session.localStorage });
    setIndexedDbPersistence(reloaded.container);
    expect(reloaded.container.resolve(MergePanelStore).getRecord('PR_1')).toBeNull();

    session.signInFromAnotherTab(`${login}-other`);
    await session.clock.advance(0);
    expect(panel.getRecord('PR_1')).toBeNull();
    expect(panel.getSent('PR_1')).toBeNull();
});

test('a stack: opened on a pull request it takes everything up to it, from the entry the whole stack (stacked PRs D11)', async () => {
    const { panel, items } = await setup();
    items.upsertMany(STACK);

    panel.open('PR_1', { wholeStack: true });
    expect(panel.stack).toEqual({ id: 'S_1', openedOn: null });
    panel.open('PR_1');
    expect(panel.stack).toEqual({ id: 'S_1', openedOn: 2 });
    panel.open('PR_9');
    expect(panel.stack).toBeNull();
});

test('a stack refused at once: recorded for it with the head of every one going, the stack read again whole, said until the panel showing it closes (D11, SP61)', async () => {
    const { panel, items, session, answers } = await setup();
    items.upsertMany(STACK);
    answers.put = REFUSED;

    panel.open('PR_1', { wholeStack: true });
    const refused = panel.merge({
        item: STACK_TOP,
        submission: { request: { method: 'SQUASH' }, edited: null },
        stack: { id: 'S_1', size: 2, going: STACK },
    });
    await session.clock.advance(0);
    expect(await refused).toEqual({ kind: 'refused', reason: REFUSAL });
    // No commit text with two or more going (D11).
    expect(session.github.requests.find(request => request.operation === MERGE)?.variables.body).toEqual({
        merge_method: 'squash',
        sha: 'head-oid',
    });

    expect(panel.getStackRecord('S_1')).toMatchObject({
        kind: 'refused',
        partway: false,
        sent: {
            going: [
                { itemId: 'PR_0', head: 'earlier-head' },
                { itemId: 'PR_1', head: 'head-oid' },
            ],
        },
    });
    await session.clock.advance(0);
    expect(session.operations()).toContain('PullRequestStacks');
    expect(panel.getStackRecord('S_1')).toMatchObject({ kind: 'refused', read: true });

    panel.close();
    expect(panel.getStackRecord('S_1')).toBeNull();
});

async function setup() {
    const login = `user-${crypto.randomUUID()}`;
    const answers: {
        put: TestRestAnswer | undefined;
        read: TestRestAnswer | undefined;
        /** The head `PullRequestMergeOptions` finds. */
        optionsHead: string;
    } = { put: undefined, read: STILL_PENDING, optionsHead: 'head-oid' };
    const session = createTestSession({
        login,
        answer: request => {
            switch (request.operation) {
                case 'PullRequestMergeOptions':
                    return mergeOptionsAnswer(answers.optionsHead);
                case 'ItemDetail':
                    return { data: { node: samplePullRequestDetailNode('PR_1', '2026-10-20T10:00:00Z') } };
                case 'PullRequestStacks':
                    return { data: { nodes: [{ id: 'S_1', entries: { totalCount: 0, nodes: [] } }] } };
                default:
                    return undefined;
            }
        },
        answerRest: request => {
            switch (request.operation) {
                case MERGE:
                    return answers.put;
                case `GET /repos/acme/web/pulls/2/merge-async/${UUID}`:
                    return answers.read;
                default:
                    return undefined;
            }
        },
    });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    await items.ready();
    items.upsertMany([samplePullRequest('PR_1')]);

    return {
        panel: session.container.resolve(MergePanelStore),
        queue: session.container.resolve(EditQueue),
        merger: session.container.resolve(PullRequestMerger),
        details: session.container.resolve(ItemDetailStore),
        items,
        session,
        answers,
        login,
    };
}

/** A round of the regular sync's `loop` that started at `startedAt`, and how it ended. */
function syncRound(startedAt: number, endedAt: number, error: string | null = null): SyncLoopState {
    return {
        lastAttemptAt: startedAt,
        lastSuccessAt: error === null ? endedAt : null,
        lastError: error,
        incomplete: false,
    };
}

function mergeOptionsAnswer(head: string): TestGraphQLAnswer {
    const data: PullRequestMergeOptionsQuery = {
        node: {
            ...samplePullRequestNode('PR_1', { repository: 'acme/web', number: 2, updatedAt: '2026-10-20T10:00:00Z' }),
            headRefOid: head,
            mergeHeadline: 'Merge pull request #2 from acme/feature',
            mergeBody: 'Fix the login loop',
            squashHeadline: 'Fix the login loop (#2)',
            squashBody: 'Fix it',
            viewerCanMergeAsAdmin: false,
            viewerCanEnableAutoMerge: false,
            isMergeQueueEnabled: false,
            headCommit: { nodes: [{ commit: { oid: head, messageHeadline: 'New', author: null } }] },
            baseRef: { target: { oid: 'base-oid' }, rules: null, branchProtectionRule: null },
            statusCheckRollup: null,
        },
    };
    return { data };
}
