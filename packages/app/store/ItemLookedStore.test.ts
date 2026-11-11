/// <reference types="bun" />
// IndexedDB for bun; every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { settle } from '@/testing/settle.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { createIndexedDbPersistence } from './IndexedDbPersistence.js';
import { KEEP_DETAIL_MS } from './ItemDetailStore.js';
import { ItemLookedStore } from './ItemLookedStore.js';

const DAY_MS = 24 * 60 * 60_000;

test('when the user last looked at an item is kept on this device, for a later session too', async () => {
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = createTestSession({ login, answer: () => undefined });
    setIndexedDbPersistence(first.container, persistence);
    const looked = first.container.resolve(ItemLookedStore);

    expect(await looked.read('I_1')).toBeNull();
    looked.mark('I_1', 1000);
    await settle();
    expect(await looked.read('I_1')).toBe(1000);
    looked.mark('I_1', 2000);
    await settle();

    const later = createTestSession({ login, answer: () => undefined, localStorage: first.localStorage });
    setIndexedDbPersistence(later.container, persistence);
    expect(await later.container.resolve(ItemLookedStore).read('I_1')).toBe(2000);
});

test("one account's looking never marks another's items, nor survives signing out", async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const session = createTestSession({ login: alice, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const looked = session.container.resolve(ItemLookedStore);
    looked.mark('I_1', 1000);
    await settle();
    expect(await looked.read('I_1')).toBe(1000);

    // Marked by alice as bob signs in: it lands nowhere.
    looked.mark('I_2', 1000);
    session.signInFromAnotherTab(bob);
    await settle();
    expect(await looked.read('I_1')).toBeNull();
    expect(await looked.read('I_2')).toBeNull();

    // Her copy went with her: back, nothing is marked.
    session.signInFromAnotherTab(alice);
    expect(await looked.read('I_1')).toBeNull();
    looked.mark('I_1', 3000);
    await settle();
    session.signOutFromAnotherTab();
    expect(await looked.read('I_1')).toBeNull();
    looked.mark('I_1', 4000);
    session.signInFromAnotherTab(alice);
    expect(await looked.read('I_1')).toBeNull();
});

test('an item not looked at for as long as a detail is kept is forgotten once the user signs in again', async () => {
    const login = uniqueLogin();
    const persistence = createIndexedDbPersistence();
    const first = createTestSession({ login, answer: () => undefined });
    setIndexedDbPersistence(first.container, persistence);
    const looked = first.container.resolve(ItemLookedStore);
    looked.mark('I_old', 1000);
    await first.clock.advance(2 * DAY_MS);
    looked.mark('I_recent', 2000);
    await settle();

    const later = createTestSession({ login, answer: () => undefined, localStorage: first.localStorage });
    setIndexedDbPersistence(later.container, persistence);
    await later.clock.advance(KEEP_DETAIL_MS + DAY_MS);
    const again = later.container.resolve(ItemLookedStore);

    expect(await again.read('I_old')).toBeNull();
    expect(await again.read('I_recent')).toBe(2000);
});
