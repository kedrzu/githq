/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';

import { getReviewBlobDatabaseName, ReviewBlobStore } from './ReviewBlobStore.js';

test('what is written is read back by another tab; a login reads nothing of another login', async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const tab = ReviewBlobStore.create();
    await tab.read(alice, []);

    await tab.write(alice, [{ oid: 'a1', text: 'secret' }]);

    expect(await ReviewBlobStore.create().read(alice, ['a1', 'a2'])).toEqual(new Map([['a1', 'secret']]));
    expect(await tab.read(bob, ['a1'])).toEqual(new Map());
});

test('deleting the local copy deletes the file contents with it, even while another tab holds them open — and no late write brings them back', async () => {
    const login = uniqueLogin();
    const tab = ReviewBlobStore.create();
    const otherTab = ReviewBlobStore.create();
    await tab.read(login, []);
    await otherTab.read(login, []);
    await tab.write(login, [{ oid: 'a1', text: 'secret' }]);
    expect(await databaseNames()).toContain(getReviewBlobDatabaseName(login));

    await createIndexedDbPersistence().destroy(login);

    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(login));
    await expect(tab.write(login, [{ oid: 'a2', text: 'late' }])).rejects.toThrow();
    await expect(otherTab.write(login, [{ oid: 'a2', text: 'late' }])).rejects.toThrow();
    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(login));

    // The next sign-in of that user starts empty.
    expect(await tab.read(login, ['a1'])).toEqual(new Map());
});

test('a write with nothing opened fails rather than creating the database', async () => {
    const login = uniqueLogin();

    await expect(ReviewBlobStore.create().write(login, [{ oid: 'a1', text: 'late' }])).rejects.toThrow();

    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(login));
});

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}
