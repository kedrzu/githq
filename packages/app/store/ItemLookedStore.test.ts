/// <reference types="bun" />
// IndexedDB for bun; every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { settle } from '@/testing/settle.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { createIndexedDbPersistence } from './IndexedDbPersistence.js';
import { ItemLookedStore } from './ItemLookedStore.js';
import type { ItemLookedStoreShape } from './ItemLookedStore.js';

test('when the user last looked at an item is kept on this device, for a later session too', async () => {
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = createTestSession({ login, answer: () => undefined });
    setIndexedDbPersistence(first.container, persistence);
    const looked = first.container.resolve(ItemLookedStore);

    expect(await lookedAt(looked, 'I_1')).toBeNull();
    looked.mark('I_1', 1000);
    await settle();
    expect(await lookedAt(looked, 'I_1')).toBe(1000);
    looked.mark('I_1', 2000);
    await settle();

    const later = createTestSession({ login, answer: () => undefined, localStorage: first.localStorage });
    setIndexedDbPersistence(later.container, persistence);
    expect(await lookedAt(later.container.resolve(ItemLookedStore), 'I_1')).toBe(2000);
});

test('while an item stays open, opening it again gets the time read at its first opening, though it was marked since', async () => {
    const session = createTestSession({ login: uniqueLogin(), answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const looked = session.container.resolve(ItemLookedStore);
    looked.mark('I_1', 1000);
    await settle();

    const first = await looked.open('I_1');
    expect(first.lookedAt).toBe(1000);
    looked.mark('I_1', 2000);
    await settle();
    // Another arrangement of the same item.
    expect(await looked.open('I_1')).toEqual(first);

    // Another item opened: the first one is read afresh.
    await looked.open('I_2');
    expect(await looked.open('I_1')).toMatchObject({ lookedAt: 2000 });
    looked.mark('I_1', 3000);
    await settle();

    // Left: read afresh too.
    looked.leave('I_1');
    expect(await looked.open('I_1')).toMatchObject({ lookedAt: 3000 });
});

test("one account's looking never marks another's items, nor survives signing out", async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const session = createTestSession({ login: alice, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const looked = session.container.resolve(ItemLookedStore);
    looked.mark('I_1', 1000);
    await settle();
    expect(await lookedAt(looked, 'I_1')).toBe(1000);

    // Marked by alice as bob signs in: it lands nowhere.
    looked.mark('I_2', 1000);
    session.signInFromAnotherTab(bob);
    await settle();
    expect(await lookedAt(looked, 'I_1')).toBeNull();
    expect(await lookedAt(looked, 'I_2')).toBeNull();

    // Her copy went with her: back, nothing is marked.
    session.signInFromAnotherTab(alice);
    expect(await lookedAt(looked, 'I_1')).toBeNull();
    looked.mark('I_1', 3000);
    await settle();
    session.signOutFromAnotherTab();
    expect(await lookedAt(looked, 'I_1')).toBeNull();
    looked.mark('I_1', 4000);
    session.signInFromAnotherTab(alice);
    expect(await lookedAt(looked, 'I_1')).toBeNull();
});

test('the item held open goes with the account: another one opening it reads their own time', async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const session = createTestSession({ login: alice, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const looked = session.container.resolve(ItemLookedStore);
    looked.mark('I_1', 1000);
    await settle();
    expect(await looked.open('I_1')).toMatchObject({ lookedAt: 1000 });

    session.signInFromAnotherTab(bob);
    expect(await looked.open('I_1')).toMatchObject({ lookedAt: null });
});

/** When the user last looked at `id`, read afresh: left first, as closing it does. */
async function lookedAt(looked: ItemLookedStoreShape, id: string) {
    looked.leave(id);
    const { lookedAt: at } = await looked.open(id);
    looked.leave(id);
    return at;
}
