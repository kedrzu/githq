/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { PullRequestMergeOptionsQuery } from '@githq/github/generated.gen.js';

import { EditQueue } from '@/edits/EditQueue.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { TestGraphQLAnswer, TestGraphQLRequest, TestRestAnswer } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { samplePullRequestNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import type { MergeAnswer } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

const MERGE_PATH = '/repos/acme/web/pulls/2/merge-async';
const UUID = 'b904';
const PENDING: TestRestAnswer = { status: 202, body: { status: 'pending', details: { uuid: UUID } } };
const STILL_PENDING: TestRestAnswer = { status: 200, body: { status: 'pending', details: { uuid: UUID } } };
const MERGED: TestRestAnswer = { status: 200, body: { status: 'merged', details: { sha: 'merge-sha' } } };

test('accepted: the panel learns at once; the row reads being merged — not merged, still open — until GitHub says merged', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'accepted' });
    expect(items.get('PR_1')).toMatchObject({ merging: true, merged: false, state: 'OPEN' });
    expect(queue.pending).toHaveLength(1);

    // Asked again and again while GitHub runs it.
    await session.clock.advance(3000);
    expect(rest.reads()).toBe(2);
    expect(items.get('PR_1')).toMatchObject({ merging: true, merged: false, state: 'OPEN' });

    rest.answers.read = MERGED;
    await session.clock.advance(4000);

    const merged = items.get('PR_1');
    expect(merged).toMatchObject({ merged: true, state: 'MERGED' });
    expect(merged?.kind === 'pullRequest' && merged.merging).toBeFalsy();
    expect(items.getStored('PR_1')).toMatchObject({ merged: true, state: 'MERGED' });
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
});

test('the head commit always goes with the merge, and the commit text only when the user edited it', async () => {
    const { merger, session, rest } = await setup();
    rest.answers.put = MERGED;

    const unedited = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);
    expect(await unedited).toEqual({ kind: 'accepted' });

    const edited = merger.merge({
        item: open(),
        request: { method: 'MERGE', title: 'Merge the login fix', body: '' },
        shown,
    });
    await session.clock.advance(0);
    expect(await edited).toEqual({ kind: 'accepted' });

    expect(rest.puts()).toEqual([
        { merge_method: 'squash', sha: 'head-oid' },
        { merge_method: 'merge', sha: 'head-oid', commit_title: 'Merge the login fix', commit_message: '' },
    ]);
});

test('merged at once: confirmed, and a sync copy read before the merge does not undo it', async () => {
    const { merger, items, session, rest } = await setup();
    rest.answers.put = MERGED;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });
    expect(items.get('PR_1')).toMatchObject({ merged: true, state: 'MERGED', closedAt: expect.any(String) });

    // A copy read before the merge arrives: still drawn merged.
    items.upsertMany([open()]);
    expect(items.get('PR_1')).toMatchObject({ merged: true, state: 'MERGED' });

    // GitHub's own merged copy takes over.
    items.upsertMany([{ ...open(), merged: true, state: 'MERGED', closedAt: '2026-10-30T13:00:05Z' }]);
    expect(items.get('PR_1')).toMatchObject({ closedAt: '2026-10-30T13:00:05Z' });
});

test('refused at once — a failed answer or an error — is the panel’s to show: undone, and no failure listed', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = { status: 405, body: { status: 'failed', details: { message: 'Head branch was modified.' } } };

    const refused = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);

    expect(await refused).toEqual({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Head branch was modified.' },
    });

    rest.answers.put = undefined;
    const failed = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);

    expect(await failed).toMatchObject({ kind: 'refused', reason: { kind: 'refused' } });
    expect(items.get('PR_1')).toMatchObject({ merged: false, state: 'OPEN' });
    expect(items.get('PR_1')).not.toHaveProperty('merging');
    expect(queue.failures).toEqual([]);
    expect(queue.undone.size).toBe(0);
    expect(rest.reads()).toBe(0);
});

test('refused at once after the panel closed: the refusal is not lost — a failed edit with GitHub’s words', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = { status: 405, body: { status: 'failed', details: { message: 'Head branch was modified.' } } };

    // The panel is closed (Esc) before GitHub answers the merge.
    let panelOpen = true;
    const refused = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown: () => panelOpen });
    panelOpen = false;
    await session.clock.advance(0);

    expect(await refused).toEqual({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Head branch was modified.' },
    });
    expect(items.get('PR_1')).not.toHaveProperty('merging');
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.reason))).toEqual([
        { kind: 'refused', message: 'Head branch was modified.' },
    ]);
    expect(queue.failures[0]?.toast).toBe(true);
});

test('a failed answer while it runs is a failed edit with GitHub’s words; a request failing meanwhile is asked again', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });

    // GitHub cannot be reached for a while.
    rest.answers.read = undefined;
    await session.clock.advance(3000);
    expect(rest.reads()).toBe(2);
    expect(items.get('PR_1')).toMatchObject({ merging: true });

    rest.answers.read = {
        status: 200,
        body: { status: 'failed', details: { message: 'Required status check failed.' } },
    };
    await session.clock.advance(4000);

    expect(items.get('PR_1')).toMatchObject({ merged: false, state: 'OPEN' });
    expect(items.get('PR_1')).not.toHaveProperty('merging');
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.reason))).toEqual([
        { kind: 'refused', message: 'Required status check failed.' },
    ]);
    expect(queue.failures[0]?.toast).toBe(true);
});

test('no answer within the time limit: being merged goes, with no failure, and nothing is asked after', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });

    await session.clock.advance(119_000);
    expect(items.get('PR_1')).toMatchObject({ merging: true });

    await session.clock.advance(1000);

    expect(items.get('PR_1')).toMatchObject({ merged: false, state: 'OPEN' });
    expect(items.get('PR_1')).not.toHaveProperty('merging');
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
    expect(queue.undone.size).toBe(0);
    // 1 s, 2 s, 4 s, then every 5 s: 7 s and 22 more within the two minutes, the last cut to the limit.
    const reads = rest.reads();
    expect(reads).toBe(26);

    await session.clock.advance(60_000);
    expect(rest.reads()).toBe(reads);
});

test('never sent for a non-writer, a closed or merged pull request, or one being merged already', async () => {
    const { merger, session, rest } = await setup();
    rest.answers.put = PENDING;

    const readOnly: PullRequestItem = { ...open(), repository: { ...open().repository, viewerPermission: 'TRIAGE' } };
    const notAllowed: MergeAnswer = { kind: 'refused', reason: { kind: 'notAllowed' } };
    expect(await merger.merge({ item: readOnly, request: { method: 'SQUASH' }, shown })).toEqual(notAllowed);
    expect(await merger.merge({ item: { ...open(), state: 'CLOSED' }, request: { method: 'SQUASH' }, shown })).toEqual(
        notAllowed,
    );
    expect(
        await merger.merge({
            item: { ...open(), state: 'MERGED', merged: true },
            request: { method: 'SQUASH' },
            shown,
        }),
    ).toEqual(notAllowed);
    expect(await merger.merge({ item: { ...open(), merging: true }, request: { method: 'SQUASH' }, shown })).toEqual(
        notAllowed,
    );
    expect(rest.puts()).toEqual([]);

    // The row the panel holds may not show it yet: the merge on its way says so.
    const first = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown });
    await session.clock.advance(0);
    expect(await first).toEqual({ kind: 'accepted' });
    expect(await merger.merge({ item: open(), request: { method: 'SQUASH' }, shown })).toEqual(notAllowed);
    expect(rest.puts()).toHaveLength(1);
});

test('the options read on opening come back, partial errors and all, and their status is written into the row', async () => {
    const { merger, items, session } = await setup();

    const reading = merger.readOptions('PR_1');
    await session.clock.advance(0);
    const options = await reading;

    expect(options).toMatchObject({
        proposedTexts: { SQUASH: { title: 'Fix the login loop (#2)', body: 'Fix it' } },
        requiresLinearHistory: false,
        status: { headRefOid: 'fresh-head' },
    });
    expect(items.getStored('PR_1')).toMatchObject({ headRefOid: 'fresh-head', title: open().title });
    expect(session.operations()).toContain('PullRequestMergeOptions');
});

async function setup() {
    const login = `user-${crypto.randomUUID()}`;
    const answers: MergeAnswers = { put: undefined, read: STILL_PENDING };
    const rest = {
        answers,
        puts: () =>
            session.github.requests
                .filter(request => request.operation === `PUT ${MERGE_PATH}`)
                .map(request => request.variables.body),
        reads: () =>
            session.github.requests.filter(request => request.operation === `GET ${MERGE_PATH}/${UUID}`).length,
    };

    const session = createTestSession({ login, answer, answerRest });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const queue = session.container.resolve(EditQueue);
    const merger = session.container.resolve(PullRequestMerger);
    await items.ready();
    items.upsertMany([open()]);

    return { merger, items, queue, session, rest };

    function answerRest(request: TestGraphQLRequest): TestRestAnswer | undefined {
        switch (request.operation) {
            case `PUT ${MERGE_PATH}`:
                return answers.put;
            case `GET ${MERGE_PATH}/${UUID}`:
                return answers.read;
            default:
                return undefined;
        }
    }
}

function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    if (request.operation !== 'PullRequestMergeOptions') {
        return undefined;
    }

    const data: PullRequestMergeOptionsQuery = {
        node: {
            ...samplePullRequestNode('PR_1', { repository: 'acme/web', number: 2, updatedAt: '2026-10-20T10:00:00Z' }),
            headRefOid: 'fresh-head',
            mergeHeadline: 'Merge pull request #2 from acme/feature',
            mergeBody: 'Fix the login loop',
            squashHeadline: 'Fix the login loop (#2)',
            squashBody: 'Fix it',
            viewerCanMergeAsAdmin: false,
            viewerCanEnableAutoMerge: false,
            isMergeQueueEnabled: false,
            baseRef: { target: { oid: 'base-oid' }, rules: null, branchProtectionRule: null },
            statusCheckRollup: null,
        },
    };
    // The protection of the base branch, unreadable without admin rights.
    return {
        data,
        errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible', path: ['node', 'baseRef'] }],
    };
}

/** How the fake GitHub answers the merge (`put`) and the questions after it (`read`); a 502 when `undefined`. */
interface MergeAnswers {
    put: TestRestAnswer | undefined;
    read: TestRestAnswer | undefined;
}

/** The merge panel still shows what GitHub answers. */
function shown() {
    return true;
}

function open(): PullRequestItem {
    return samplePullRequest('PR_1');
}
