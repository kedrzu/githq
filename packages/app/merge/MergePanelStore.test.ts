/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { PullRequestMergeOptionsQuery } from '@githq/github/generated.gen.js';

import { EditQueue } from '@/edits/EditQueue.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestRestAnswer } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { samplePullRequestNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { MergePanelStore } from './MergePanelStore.js';
import type { MergeOptions, MergeSubmission } from './MergeTypes.js';

const MERGE = 'PUT /repos/acme/web/pulls/2/merge-async';
const UUID = 'b904';
const MERGED: TestRestAnswer = { status: 200, body: { status: 'merged', details: { sha: 'merge-sha' } } };
const REFUSED: TestRestAnswer = {
    status: 405,
    body: { status: 'failed', details: { message: 'Required status check "ci" is expected.' } },
};
/** GitHub's answer to a merge naming a head that is no longer the head (live, 2026-11-02). */
const HEAD_MODIFIED: TestRestAnswer = {
    status: 400,
    body: { status: 'failed', details: { message: 'Pull request head branch was modified.' } },
};
const PENDING: TestRestAnswer = { status: 202, body: { status: 'pending', details: { uuid: UUID } } };
const STILL_PENDING: TestRestAnswer = { status: 200, body: { status: 'pending', details: { uuid: UUID } } };

/** The edited text, as the panel sends it: only the title differs from GitHub's. */
const EDITED: MergeSubmission = {
    request: { method: 'SQUASH', title: 'Edited' },
    edited: { title: 'Edited', body: 'Fix it' },
};

test('accepted: the panel leaves and the opener moves on; refused at once: it stays, nothing moves, nothing toasts', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);

    expect(await refused).toEqual({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Required status check "ci" is expected.' },
    });
    expect(panel.itemId).toBe('PR_1');
    expect(sent).toEqual([]);
    expect(queue.failures).toEqual([]);

    answers.put = MERGED;
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);

    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(panel.itemId).toBeNull();
    expect(sent).toEqual(['PR_1']);
});

test('closed before GitHub answers: the opener does not move on, and a refusal is reported like a failed edit', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = MERGED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const accepted = panel.merge({
        item: samplePullRequest('PR_1'),
        submission: { request: { method: 'MERGE' }, edited: null },
        reread: readAs('head-oid'),
    });
    panel.close();
    await session.clock.advance(0);
    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(sent).toEqual([]);

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    // Opened for another pull request while this merge is on its way.
    panel.open('PR_9');
    await session.clock.advance(0);

    expect(await refused).toMatchObject({ kind: 'refused' });
    expect(panel.itemId).toBe('PR_9');
    expect(sent).toEqual([]);
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.reason))).toEqual([
        { kind: 'refused', message: 'Required status check "ci" is expected.' },
    ]);
});

test('PM25: a refusal while the head stayed is recorded with GitHub’s reason and the edited text, and goes once the next merge is sent', async () => {
    const { panel, session, answers } = await setup();

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);
    await refused;

    expect(panel.getRecord('PR_1')).toEqual({
        kind: 'refused',
        sent: { ...EDITED, head: 'head-oid' },
        reason: { kind: 'refused', message: 'Required status check "ci" is expected.' },
    });

    answers.put = MERGED;
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    expect(panel.getRecord('PR_1')).toBeNull();
    await session.clock.advance(0);
    await accepted;
    expect(panel.getRecord('PR_1')).toBeNull();
});

test('PM27: a moved head is told apart by reading the head again, not by GitHub’s words — any refusal naming an old head', async () => {
    const { panel, session, answers } = await setup();
    panel.open('PR_1');

    // GitHub's words for it: told apart all the same, by the head the panel's read finds.
    answers.put = HEAD_MODIFIED;
    const moved = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('new-head') });
    await session.clock.advance(0);
    await moved;

    expect(panel.getRecord('PR_1')).toEqual({
        kind: 'headMoved',
        sent: { ...EDITED, head: 'head-oid' },
        head: 'new-head',
        commit: { oid: 'new-head', headline: 'Handle an empty billing answer', author: 'dkim' },
    });

    // Other words, the same moved head: it is the head that tells.
    answers.put = REFUSED;
    const other = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('new-head') });
    await session.clock.advance(0);
    await other;
    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'headMoved', head: 'new-head' });

    // GitHub's words for a moved head, with the head where the merge named it: a refusal like any other.
    answers.put = HEAD_MODIFIED;
    const stayed = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);
    await stayed;
    expect(panel.getRecord('PR_1')).toMatchObject({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Pull request head branch was modified.' },
    });
});

test('PM28: a method the rules read after it was sent don’t allow is recorded as such, with the text sent', async () => {
    const { panel, session, answers } = await setup();
    const submission: MergeSubmission = {
        request: { method: 'MERGE', title: 'Merge the login fix' },
        edited: { title: 'Merge the login fix', body: 'Fix the login loop' },
    };

    answers.put = REFUSED;
    panel.open('PR_1');
    const refused = panel.merge({
        item: samplePullRequest('PR_1'),
        submission,
        reread: readAs('head-oid', { allowedMergeMethods: ['SQUASH'] }),
    });
    await session.clock.advance(0);
    await refused;

    expect(panel.getRecord('PR_1')).toEqual({ kind: 'methodNotAllowed', sent: { ...submission, head: 'head-oid' } });
});

test('PM29: accepted, then no answer within the time limit — recorded as not known, with the text sent', async () => {
    const { panel, session, answers } = await setup();
    answers.put = PENDING;

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);
    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(panel.getRecord('PR_1')).toBeNull();

    await session.clock.advance(120_000);
    expect(panel.getRecord('PR_1')).toEqual({ kind: 'unknown', sent: { ...EDITED, head: 'head-oid' } });
});

test('refused while it ran, after the panel left: GitHub is asked for the head itself, and a moved one is recorded', async () => {
    const { panel, session, answers } = await setup();
    answers.put = PENDING;
    answers.optionsHead = 'new-head';

    panel.open('PR_1');
    const accepted = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
    await session.clock.advance(0);
    await accepted;

    answers.read = {
        status: 200,
        body: { status: 'failed', details: { message: 'Pull request head branch was modified.' } },
    };
    await session.clock.advance(1000);
    await session.clock.advance(0);

    expect(panel.getRecord('PR_1')).toMatchObject({ kind: 'headMoved', head: 'new-head' });
    expect(session.operations()).toContain('PullRequestMergeOptions');
});

test('the records live in memory only: another account starts with none, and a reload with none', async () => {
    const { panel, session, answers, login } = await setup();
    answers.put = REFUSED;

    panel.open('PR_1');
    const refused = panel.merge({ item: samplePullRequest('PR_1'), submission: EDITED, reread: readAs('head-oid') });
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
        answer: request =>
            request.operation === 'PullRequestMergeOptions' ? mergeOptionsAnswer(answers.optionsHead) : undefined,
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
        session,
        answers,
        login,
    };
}

/** The panel's read again, finding the head at `head` and the rules as given. */
function readAs(head: string, rules: Partial<Pick<MergeOptions, 'allowedMergeMethods'>> = {}) {
    const options: MergeOptions = {
        status: { ...samplePullRequest('PR_1'), headRefOid: head },
        proposedTexts: {
            MERGE: { title: 'Merge pull request #2 from acme/feature', body: 'Fix the login loop' },
            SQUASH: { title: 'Fix the login loop (#2)', body: 'Fix it' },
        },
        allowedMergeMethods: null,
        requiresLinearHistory: false,
        viewerCanMergeAsAdmin: false,
        viewerCanEnableAutoMerge: false,
        isMergeQueueEnabled: false,
        checks: [],
        headCommit: { oid: head, headline: 'Handle an empty billing answer', author: 'dkim' },
        ...rules,
    };
    return () => Promise.resolve(options);
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
