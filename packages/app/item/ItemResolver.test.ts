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

test('an item the local copy holds is found at once, whatever the case of its address, without asking GitHub', async () => {
    const { resolver, items, session } = await setup();
    items.upsertMany([{ ...sampleIssue('I_held'), number: 12 }]);

    await resolver.resolve({ owner: 'Acme', name: 'Web', number: 12 });

    expect(resolver.peek({ owner: 'Acme', name: 'Web', number: 12 })).toBe('I_held');
    expect(session.operations()).not.toContain('ItemByNumber');
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

test('an address GitHub knows no item at is told apart from one not known yet; a failed request leaves it unknown', async () => {
    const { resolver } = await setup();

    await resolver.resolve({ owner: 'acme', name: 'gone', number: 1 });
    expect(resolver.peek({ owner: 'acme', name: 'gone', number: 1 })).toBeNull();

    await resolver.resolve({ owner: 'acme', name: 'web', number: 500 });
    expect(resolver.peek({ owner: 'acme', name: 'web', number: 500 })).toBeUndefined();
});

test('what was found for one user is forgotten when they sign out', async () => {
    const { resolver, session } = await setup();
    const reference = { owner: 'acme', name: 'web', number: 7 };
    await resolver.resolve(reference);

    session.signOutFromAnotherTab();

    expect(resolver.peek(reference)).toBeUndefined();
});

async function setup() {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer });
    session.container.set(ItemPersistence, createIndexedDbPersistence());
    const items = session.container.resolve(ItemStore);
    const resolver = session.container.resolve(ItemResolver);
    await items.ready();
    return { session, items, resolver };
}

/** As GitHub answers: `acme/web` holds #7; another repository does not exist; #500 fails. */
function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
    const { name, number } = request.variables;
    if (request.operation !== 'ItemByNumber' || number === 500) {
        return undefined;
    }

    return name === 'web'
        ? { data: { repository: { issueOrPullRequest: { id: `I_${String(number)}` } } } }
        : {
              data: { repository: null },
              errors: [{ type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve to a Repository' }],
          };
}
