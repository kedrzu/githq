/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { ItemResolver } from './ItemResolver.js';

/** Every wait between the tries, and then some. */
const ALL_THE_WAITS_MS = 32_000;

test('an item the local copy holds is found at once, whatever the case of its address, without asking GitHub', async () => {
    const { resolver, items, session } = await setup();
    items.upsertMany([{ ...sampleIssue('I_held'), number: 12 }]);

    await resolver.resolve({ owner: 'Acme', name: 'Web', number: 12 });

    expect(resolver.peek({ owner: 'Acme', name: 'Web', number: 12 })).toBe('I_held');
    expect(session.operations()).not.toContain('ItemByNumber');
});

test('an item whose row left the copy keeps its id, without asking GitHub, until its user signs out', async () => {
    const { resolver, items, session } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 12 };
    items.upsertMany([{ ...sampleIssue('I_held'), number: 12 }]);
    expect(resolver.peek(reference)).toBe('I_held');

    items.remove(['I_held']);

    expect(resolver.peek(reference)).toBe('I_held');
    expect(session.operations()).not.toContain('ItemByNumber');

    session.signOutFromAnotherTab();
    expect(resolver.peek(reference)).toBeUndefined();
});

test('an item outside the copy is asked for once, however often it is opened meanwhile, and remembered', async () => {
    const { resolver, session } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 7 };

    expect(resolver.peek(reference)).toBeUndefined();
    await Promise.all([resolver.resolve(reference), resolver.resolve(reference)]);
    await resolver.resolve(reference);

    expect(resolver.peek(reference)).toBe('I_7');
    expect(
        session.github.requests
            .filter(request => request.operation === 'ItemByNumber')
            .map(request => request.variables),
    ).toEqual([{ owner: 'acme', name: 'web', number: 7 }]);
});

test('an address GitHub knows no item at is told apart from one not known yet, asked for once and not a failure', async () => {
    const { resolver, session, asked } = await setup();
    const gone = { owner: 'acme', name: 'gone', number: 1 };

    await resolver.resolve(gone);
    await session.clock.advance(ALL_THE_WAITS_MS);

    expect(resolver.peek(gone)).toBeNull();
    expect(resolver.hasFailed(gone)).toBe(false);
    expect(asked()).toBe(1);
});

test('no answer: asked again after 1, 2, 4, 8 and 16 seconds, unknown meanwhile, then failed', async () => {
    const { resolver, session, asked } = await setup();
    const failing = { owner: 'acme', name: 'web', number: 500 };

    const resolved = resolver.resolve(failing);
    for (const [wait, times] of [
        [0, 1],
        [1000, 2],
        [2000, 3],
        [4000, 4],
        [8000, 5],
    ] as const) {
        await session.clock.advance(wait);
        expect(asked()).toBe(times);
        expect(resolver.peek(failing)).toBeUndefined();
        expect(resolver.hasFailed(failing)).toBe(false);
    }

    await session.clock.advance(16_000);
    await resolved;

    expect(asked()).toBe(6);
    expect(resolver.peek(failing)).toBeUndefined();
    expect(resolver.hasFailed(failing)).toBe(true);
});

test('an answer on a later try finds the item, and no failure is said', async () => {
    const { resolver, session, network, asked } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 7 };

    network.down = true;
    const resolved = resolver.resolve(reference);
    await session.clock.advance(0);
    network.down = false;
    await session.clock.advance(1000);
    await resolved;

    expect(resolver.peek(reference)).toBe('I_7');
    expect(resolver.hasFailed(reference)).toBe(false);
    expect(asked()).toBe(2);
});

test('after giving up it can be asked for again: unknown and not failed meanwhile, then found', async () => {
    const { resolver, session, network } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 7 };
    network.down = true;
    const gaveUp = resolver.resolve(reference);
    await session.clock.advance(ALL_THE_WAITS_MS);
    await gaveUp;
    expect(resolver.hasFailed(reference)).toBe(true);

    network.down = false;
    const again = resolver.resolve(reference);
    expect(resolver.hasFailed(reference)).toBe(false);
    await again;

    expect(resolver.peek(reference)).toBe('I_7');
});

test('GitHub refusing — a rate limit, say — fails at once, without spending the allowance on asking again', async () => {
    const { resolver, session, asked } = await setup();
    const limited = { owner: 'acme', name: 'web', number: 429 };

    await resolver.resolve(limited);
    await session.clock.advance(ALL_THE_WAITS_MS);

    expect(asked()).toBe(1);
    expect(resolver.peek(limited)).toBeUndefined();
    expect(resolver.hasFailed(limited)).toBe(true);
});

test('the item reaching the local copy during a wait ends the asking', async () => {
    const { resolver, items, session, asked } = await setup();
    const failing = { owner: 'acme', name: 'web', number: 500 };

    const resolved = resolver.resolve(failing);
    await session.clock.advance(0);
    items.upsertMany([{ ...sampleIssue('I_held'), number: 500 }]);
    await session.clock.advance(ALL_THE_WAITS_MS);
    await resolved;

    expect(asked()).toBe(1);
    expect(resolver.peek(failing)).toBe('I_held');
    expect(resolver.hasFailed(failing)).toBe(false);
});

test('signing out during a wait ends the asking, and says no failure', async () => {
    const { resolver, session, asked } = await setup();
    const failing = { owner: 'acme', name: 'web', number: 500 };

    const resolved = resolver.resolve(failing);
    await session.clock.advance(0);
    session.signOutFromAnotherTab();
    await session.clock.advance(ALL_THE_WAITS_MS);
    await resolved;

    expect(asked()).toBe(1);
    expect(resolver.hasFailed(failing)).toBe(false);
});

test('what was found for one user is forgotten when they sign out', async () => {
    const { resolver, session } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 7 };
    await resolver.resolve(reference);

    session.signOutFromAnotherTab();

    expect(resolver.peek(reference)).toBeUndefined();
});

async function setup() {
    const network = { down: false };
    const session = createTestSession({
        login: `user-${crypto.randomUUID()}`,
        answer: request => (network.down ? undefined : answer(request)),
    });
    session.container.set(ItemPersistence, createIndexedDbPersistence());
    const items = session.container.resolve(ItemStore);
    const resolver = session.container.resolve(ItemResolver);
    await items.ready();
    return {
        session,
        items,
        resolver,
        network,
        asked: () => session.operations().filter(operation => operation === 'ItemByNumber').length,
    };
}

/** As GitHub answers: `acme/web` holds #7; another repository does not exist; #500 fails; #429 is refused for the rate. */
function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    const { name, number } = request.variables;
    if (request.operation !== 'ItemByNumber' || number === 500) {
        return undefined;
    }

    if (number === 429) {
        return { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] };
    }

    return name === 'web'
        ? { data: { repository: { issueOrPullRequest: { id: `I_${String(number)}` } } } }
        : {
              data: { repository: null },
              errors: [{ type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve to a Repository' }],
          };
}
