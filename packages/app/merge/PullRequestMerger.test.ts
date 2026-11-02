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

import type { MergeAnswer, MergeLateEnd } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

const MERGE_PATH = '/repos/acme/web/pulls/2/merge-async';
const UUID = 'b904';
const PENDING: TestRestAnswer = { status: 202, body: { status: 'pending', details: { uuid: UUID } } };
const STILL_PENDING: TestRestAnswer = { status: 200, body: { status: 'pending', details: { uuid: UUID } } };
const MERGED: TestRestAnswer = { status: 200, body: { status: 'merged', details: { sha: 'merge-sha' } } };
const ENQUEUED: TestRestAnswer = { status: 202, body: { status: 'enqueued', details: {} } };

test('accepted: the panel learns at once; the row reads being merged — not merged, still open — until GitHub says merged', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'accepted' });
    expect(items.get('PR_1')).toMatchObject({ merging: 'SQUASH', merged: false, state: 'OPEN' });
    expect(queue.pending).toHaveLength(1);

    // Asked again and again while GitHub runs it.
    await session.clock.advance(3000);
    expect(rest.reads()).toBe(2);
    expect(items.get('PR_1')).toMatchObject({ merging: 'SQUASH', merged: false, state: 'OPEN' });

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

    const unedited = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);
    expect(await unedited).toEqual({ kind: 'merged' });

    const edited = merger.merge({
        item: open(),
        request: { method: 'MERGE', title: 'Merge the login fix', body: '' },
        shown,
        onLateEnd,
    });
    await session.clock.advance(0);
    expect(await edited).toEqual({ kind: 'merged' });

    expect(rest.puts()).toEqual([
        { merge_method: 'squash', sha: 'head-oid' },
        { merge_method: 'merge', sha: 'head-oid', commit_title: 'Merge the login fix', commit_message: '' },
    ]);
});

test('merged at once: confirmed, and a sync copy read before the merge does not undo it', async () => {
    const { merger, items, session, rest } = await setup();
    rest.answers.put = MERGED;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'merged' });
    // How it landed, for the panel (PM26): only this app's merge knows it.
    expect(items.get('PR_1')).toMatchObject({
        merged: true,
        state: 'MERGED',
        closedAt: expect.any(String),
        mergedAs: { method: 'SQUASH', sha: 'merge-sha' },
    });

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

    const refused = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);

    expect(await refused).toEqual({
        kind: 'refused',
        reason: { kind: 'refused', message: 'Head branch was modified.' },
    });

    rest.answers.put = undefined;
    const failed = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
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
    const refused = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown: () => panelOpen, onLateEnd });
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

test('a failed answer while it runs, the panel gone, is a failed edit with GitHub’s words; a request failing meanwhile is asked again', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown: () => false, onLateEnd });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });

    // GitHub cannot be reached for a while.
    rest.answers.read = undefined;
    await session.clock.advance(3000);
    expect(rest.reads()).toBe(2);
    expect(items.get('PR_1')).toMatchObject({ merging: 'SQUASH' });

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
    expect(lateEnds).toEqual([
        { kind: 'refused', reason: { kind: 'refused', message: 'Required status check failed.' } },
    ]);
});

test('PM30: sent again after a reload, of a pull request GitHub merged meanwhile — 200 merged: the answer says merged, it reads merged, never refused', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = {
        status: 200,
        body: { status: 'merged', details: { message: 'Pull request was merged.', sha: 'merge-sha' } },
    };

    // After a reload githq knows only what GitHub last said: open, ready.
    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'merged' });
    expect(items.get('PR_1')).toMatchObject({ merged: true, mergedAs: { method: 'SQUASH', sha: 'merge-sha' } });
    expect(queue.failures).toEqual([]);
    // The answer says it: no end comes late.
    expect(lateEnds).toEqual([]);
});

test('PM30: sent again after a reload while one runs — 409 with its uuid: accepted, and followed until GitHub says merged', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = {
        status: 409,
        body: { status: 'pending', details: { message: 'Merge request is in progress.', uuid: UUID } },
    };

    const answering = merger.merge({ item: open(), request: { method: 'MERGE' }, shown, onLateEnd });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'accepted' });
    expect(items.get('PR_1')).toMatchObject({ merging: 'MERGE', merged: false });

    rest.answers.read = MERGED;
    await session.clock.advance(1000);

    expect(items.get('PR_1')).toMatchObject({ merged: true, mergedAs: { method: 'MERGE', sha: 'merge-sha' } });
    expect(queue.failures).toEqual([]);
});

test.each([
    ['as it is asked', { put: ENQUEUED, read: STILL_PENDING }],
    ['while it runs', { put: PENDING, read: { status: 200, body: { status: 'enqueued', details: {} } } }],
])(
    'put in the merge queue %s: accepted, being merged goes with no failure, and the sync shows the queue',
    async (_, answers) => {
        const { merger, items, queue, session, rest } = await setup();
        rest.answers.put = answers.put;
        rest.answers.read = answers.read;

        const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
        await session.clock.advance(0);
        expect(await answering).toEqual({ kind: 'accepted' });

        await session.clock.advance(1000);

        expect(items.get('PR_1')).toMatchObject({ merged: false, state: 'OPEN' });
        expect(items.get('PR_1')).not.toHaveProperty('merging');
        expect(queue.pending).toEqual([]);
        expect(queue.failures).toEqual([]);
        expect(queue.undone.size).toBe(0);
    },
);

test('no answer within the time limit: being merged goes, with no failure, and nothing is asked after', async () => {
    const { merger, items, queue, session, rest } = await setup();
    rest.answers.put = PENDING;

    const answering = merger.merge({ item: open(), request: { method: 'SQUASH' }, shown, onLateEnd });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });

    await session.clock.advance(119_000);
    expect(items.get('PR_1')).toMatchObject({ merging: 'SQUASH' });

    await session.clock.advance(1000);

    expect(items.get('PR_1')).toMatchObject({ merged: false, state: 'OPEN' });
    expect(items.get('PR_1')).not.toHaveProperty('merging');
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
    expect(queue.undone.size).toBe(0);
    expect(lateEnds).toEqual([{ kind: 'unknown' }]);
    // 1 s, 2 s, 4 s, then every 5 s: 7 s and 22 more within the two minutes, the last cut to the limit.
    const reads = rest.reads();
    expect(reads).toBe(26);

    await session.clock.advance(60_000);
    expect(rest.reads()).toBe(reads);
});

test('never sent for a non-writer, a closed or merged pull request, or one being merged already', async () => {
    const { merger, rest } = await setup();
    rest.answers.put = PENDING;

    const readOnly: PullRequestItem = { ...open(), repository: { ...open().repository, viewerPermission: 'TRIAGE' } };
    const notAllowed: MergeAnswer = { kind: 'refused', reason: { kind: 'notAllowed' } };
    expect(await merger.merge({ item: readOnly, request: { method: 'SQUASH' }, shown, onLateEnd })).toEqual(notAllowed);
    expect(
        await merger.merge({ item: { ...open(), state: 'CLOSED' }, request: { method: 'SQUASH' }, shown, onLateEnd }),
    ).toEqual(notAllowed);
    expect(
        await merger.merge({
            item: { ...open(), state: 'MERGED', merged: true },
            request: { method: 'SQUASH' },
            shown,
            onLateEnd,
        }),
    ).toEqual(notAllowed);
    expect(
        await merger.merge({ item: { ...open(), merging: 'SQUASH' }, request: { method: 'SQUASH' }, shown, onLateEnd }),
    ).toEqual(notAllowed);
    expect(rest.puts()).toEqual([]);
});

test('a stack: one merge of the top with its head; every one going reads being merged — none merged — until GitHub says merged (stacked PRs D11, D3)', async () => {
    const { merger, items, queue, session, rest } = await setup();
    items.upsertMany([earlier()]);
    rest.answers.put = PENDING;

    const answering = merger.merge({
        item: open(),
        members: [earlier()],
        request: { method: 'SQUASH' },
        shown,
        onLateEnd,
    });
    await session.clock.advance(0);

    expect(await answering).toEqual({ kind: 'accepted' });
    expect(rest.puts()).toEqual([{ merge_method: 'squash', sha: 'head-oid' }]);
    for (const id of ['PR_0', 'PR_1']) {
        expect(items.get(id)).toMatchObject({ merging: 'SQUASH', merged: false, state: 'OPEN' });
    }

    await session.clock.advance(3000);
    expect(items.get('PR_0')).toMatchObject({ merging: 'SQUASH', merged: false });

    rest.answers.read = MERGED;
    await session.clock.advance(4000);

    for (const id of ['PR_0', 'PR_1']) {
        expect(items.get(id)).toMatchObject({ merged: true, state: 'MERGED' });
        expect(items.get(id)).not.toHaveProperty('merging');
    }
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
});

test('a stack refused while it ran: being merged goes from every one, those earlier with no word — what landed shows once the stack is read again', async () => {
    const { merger, items, queue, session, rest } = await setup();
    items.upsertMany([earlier()]);
    rest.answers.put = PENDING;

    const answering = merger.merge({
        item: open(),
        members: [earlier()],
        request: { method: 'SQUASH' },
        shown: () => false,
        onLateEnd,
    });
    await session.clock.advance(0);
    expect(await answering).toEqual({ kind: 'accepted' });

    rest.answers.read = { status: 200, body: { status: 'failed', details: { message: 'Stack needs to be rebased' } } };
    await session.clock.advance(1000);

    for (const id of ['PR_0', 'PR_1']) {
        expect(items.get(id)).toMatchObject({ merged: false, state: 'OPEN' });
        expect(items.get(id)).not.toHaveProperty('merging');
    }
    // The merge's own refusal is reported, once.
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.edit.itemId))).toEqual(['PR_1']);
});

test('a stack read again whole: its pull requests as GitHub holds them are written into the copy', async () => {
    const { merger, items, session } = await setup();
    items.upsertMany([earlier()]);

    const reading = merger.readStack('S_1', 2);
    await session.clock.advance(0);
    expect(await reading).toBe(true);

    expect(session.operations()).toContain('PullRequestStacks');
    expect(items.get('PR_0')).toMatchObject({ merged: true, state: 'MERGED' });
});

test('a stack read again: it says it was not, when GitHub could not be asked', async () => {
    const { merger, session } = await setup();
    stackAnswered = false;

    const reading = merger.readStack('S_1', 2);
    await session.clock.advance(0);

    expect(await reading).toBe(false);
});

test('SK7: a stack read again tells who left it, as the sync does, and asks for no more than a stack holds', async () => {
    const { merger, items, session } = await setup();
    items.upsertMany([
        { ...earlier(), stack: { id: 'S_1', number: 1, size: 2, position: 1 } },
        { ...open(), stack: { id: 'S_1', number: 1, size: 2, position: 2 } },
    ]);
    stackTotalCount = 1;

    const reading = merger.readStack('S_1', 250);
    await session.clock.advance(0);
    await reading;

    expect(items.getStored('PR_1')).toMatchObject({ stack: null });
    expect(session.github.requests.find(request => request.operation === 'PullRequestStacks')?.variables.first).toBe(
        100,
    );
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
        headCommit: { oid: 'fresh-head', headline: 'Handle an empty billing answer', author: 'dkim' },
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
    lateEnds.length = 0;
    stackTotalCount = 2;
    stackAnswered = true;

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
    if (request.operation === 'PullRequestStacks' && stackAnswered) {
        const merged = samplePullRequestNode('PR_0', {
            repository: 'acme/web',
            number: 1,
            updatedAt: '2026-10-20T10:00:00Z',
            open: false,
        });
        return {
            data: {
                nodes: [{ id: 'S_1', entries: { totalCount: stackTotalCount, nodes: [{ pullRequest: merged }] } }],
            },
        };
    }

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
            headCommit: {
                nodes: [
                    {
                        commit: {
                            oid: 'fresh-head',
                            messageHeadline: 'Handle an empty billing answer',
                            author: { name: 'Dana Kim', user: { login: 'dkim' } },
                        },
                    },
                ],
            },
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

/** The merge panel shows the pull request. */
function shown() {
    return true;
}

/** How many pull requests the fake GitHub says the stack holds; it lists one. */
let stackTotalCount = 2;
/** Whether the fake GitHub answers reading the stack again. */
let stackAnswered = true;

/** How the merges GitHub accepted ended. */
const lateEnds: MergeLateEnd[] = [];

function onLateEnd(end: MergeLateEnd) {
    lateEnds.push(end);
}

function open(): PullRequestItem {
    return samplePullRequest('PR_1');
}

/** The pull request before {@link open} in its stack. */
function earlier(): PullRequestItem {
    return { ...samplePullRequest('PR_0'), number: 1, headRefOid: 'earlier-head' };
}
