/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { EditQueue } from '@/edits/EditQueue.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestRestAnswer } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { MergePanelStore } from './MergePanelStore.js';

const MERGE = 'PUT /repos/acme/web/pulls/2/merge-async';
const MERGED: TestRestAnswer = { status: 200, body: { status: 'merged', details: { sha: 'merge-sha' } } };
const REFUSED: TestRestAnswer = {
    status: 405,
    body: { status: 'failed', details: { message: 'Required status check "ci" is expected.' } },
};

test('accepted: the panel leaves and the opener moves on; refused at once: it stays, nothing moves, nothing toasts', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge(samplePullRequest('PR_1'), { method: 'SQUASH', title: 'Edited' });
    await session.clock.advance(0);

    expect(await refused).toEqual({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Required status check "ci" is expected.' },
    });
    expect(panel.itemId).toBe('PR_1');
    expect(sent).toEqual([]);
    expect(queue.failures).toEqual([]);

    answers.put = MERGED;
    const accepted = panel.merge(samplePullRequest('PR_1'), { method: 'SQUASH', title: 'Edited' });
    await session.clock.advance(0);

    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(panel.itemId).toBeNull();
    expect(sent).toEqual(['PR_1']);
    expect(panel.getSentMethod('PR_1')).toBe('SQUASH');
});

test('closed before GitHub answers: the opener does not move on, and a refusal is reported like a failed edit', async () => {
    const { panel, queue, session, answers } = await setup();
    const sent: string[] = [];

    answers.put = MERGED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const accepted = panel.merge(samplePullRequest('PR_1'), { method: 'MERGE' });
    panel.close();
    await session.clock.advance(0);
    expect(await accepted).toEqual({ kind: 'accepted' });
    expect(sent).toEqual([]);

    answers.put = REFUSED;
    panel.open('PR_1', { onSent: () => sent.push('PR_1') });
    const refused = panel.merge(samplePullRequest('PR_1'), { method: 'SQUASH' });
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

async function setup() {
    const answers: { put: TestRestAnswer | undefined } = { put: undefined };
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: () => undefined,
        answerRest: request => (request.operation === MERGE ? answers.put : undefined),
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
    };
}
