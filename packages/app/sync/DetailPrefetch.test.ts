/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemDetailPersistence } from '@/store/ItemDetailPersistence.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { toItem } from '@/store/toItem.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { sampleIssueDetailNode } from '@/testing/sampleDetailNodes.js';

import { DetailPrefetch } from './DetailPrefetch.js';

const MONDAY = '2026-10-26T10:00:00Z';
const TUESDAY = '2026-10-27T10:00:00Z';

test('after a "my work" poll, the details missing or behind their item are read in batches of 10, one batch at a time', async () => {
    const { session, items, details, poll, batches, world } = await setup();
    const first = issueIds(1, 5);
    world.updatedAt.set('I_gone', MONDAY);
    world.gone.add('I_gone');
    poll([...first, 'I_gone']);
    await session.clock.advance(0);
    expect(batches()).toEqual([[...first, 'I_gone']]);
    expect(details.needsFetch('I_1')).toBe(false);

    // The next poll: 18 new items, and one of the first five edited. Read only those; the deleted one not again.
    const next = issueIds(6, 23);
    world.updatedAt.set('I_3', TUESDAY);
    await session.clock.advance(30_000);
    expect(batches()).toHaveLength(1);
    poll([...first, 'I_gone', ...next]);
    await session.clock.advance(0);
    expect(batches().slice(1)).toEqual([['I_3', ...issueIds(6, 14)]]);

    // The next batch waits for a pause after the one before.
    await session.clock.advance(1_000);
    expect(batches()).toHaveLength(2);
    await session.clock.advance(1_000);
    expect(batches().slice(2)).toEqual([issueIds(15, 23)]);

    await session.clock.advance(60_000);
    expect(batches()).toHaveLength(3);
    expect(items.get('I_3')?.updatedAt).toBe(TUESDAY);
    expect(details.get('I_3')?.item.updatedAt).toBe(TUESDAY);
});

test('nothing is read ahead while fewer than 500 GraphQL points are left — the next poll after they reset goes on — or while the tab is hidden', async () => {
    const { session, poll, batches } = await setup();
    const ids = issueIds(1, 30);
    session.github.graphqlRemaining = 450;
    poll(ids);
    await session.clock.advance(0);
    // The first batch learnt how little is left: no second one.
    expect(batches()).toHaveLength(1);

    await session.clock.advance(10 * 60_000);
    poll(ids);
    await session.clock.advance(60_000);
    expect(batches()).toHaveLength(1);

    // The allowance reset (an hour after the answer); the tab is hidden at the next poll.
    session.github.graphqlRemaining = 4800;
    await session.clock.advance(60 * 60_000);
    session.setVisible(false);
    poll(ids);
    await session.clock.advance(60_000);
    expect(batches()).toHaveLength(1);

    session.setVisible(true);
    await session.clock.advance(10_000);
    expect(batches()).toHaveLength(3);
});

test('signing out stops the prefetch: the batch on its way is not kept, and no other follows', async () => {
    const { session, details, poll, batches } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;
    poll(issueIds(1, 25));
    await session.clock.advance(0);
    expect(batches()).toHaveLength(1);

    session.signOutFromAnotherTab();
    held.resolve();
    await session.clock.advance(60_000);

    expect(batches()).toHaveLength(1);
    expect(details.get('I_1')).toBeUndefined();
});

async function setup() {
    const world = {
        /** Each issue's `updatedAt`; `MONDAY` unless set. */
        updatedAt: new Map<string, string>(),
        /** Deleted: GitHub answers `null` with `NOT_FOUND`. */
        gone: new Set<string>(),
    };
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer });
    const persistence = createIndexedDbPersistence();
    session.container.set(ItemPersistence, persistence);
    session.container.set(ItemDetailPersistence, persistence);
    const items = session.container.resolve(ItemStore);
    const details = session.container.resolve(ItemDetailStore);
    session.container.resolve(DetailPrefetch);
    await items.ready();
    await details.ready();

    return {
        session,
        items,
        details,
        world,
        poll,
        batches,
    };

    /** A "my work" poll succeeding: it found `ids` (assigned), as GitHub has them now. */
    function poll(ids: readonly string[]) {
        items.upsertMany(ids.map(id => row(id, world.updatedAt.get(id) ?? MONDAY)));
        items.setMembership('assigned', ids);
        const now = session.clock.now();
        items.setSyncState('myWork', { lastAttemptAt: now, lastSuccessAt: now, lastError: null, incomplete: false });
    }

    /** The ids of each `ItemDetails` call. */
    function batches() {
        return session.github.requests
            .filter(request => request.operation === 'ItemDetails')
            .map(request => request.variables.ids);
    }

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (request.operation !== 'ItemDetails' || !Array.isArray(request.variables.ids)) {
            return undefined;
        }

        const ids = request.variables.ids.map(String);
        const errors: GitHubGraphQLErrorEntry[] = [];
        const nodes = ids.map((id, index) => {
            if (world.gone.has(id)) {
                errors.push({ type: 'NOT_FOUND', path: ['nodes', index], message: 'Not found' });
                return null;
            }

            return sampleIssueDetailNode(id, world.updatedAt.get(id) ?? MONDAY);
        });
        return { data: { nodes }, errors };
    }
}

function row(id: string, updatedAt: string): Item {
    const item = toItem(sampleIssueDetailNode(id, updatedAt));
    if (!item) {
        throw new Error('An issue always makes a row');
    }

    return item;
}

function issueIds(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, index) => `I_${from + index}`);
}
