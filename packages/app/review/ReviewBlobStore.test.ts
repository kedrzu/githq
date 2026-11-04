/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { openDB } from 'idb';

import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';

import { getReviewBlobDatabaseName, ReviewBlobStore } from './ReviewBlobStore.js';
import type { ReviewKeptFileList, ReviewKeptResolution, ReviewKeptState } from './ReviewBlobStore.js';
import type { ReviewThread } from './threads/ReviewThread.js';

const FILE_LIST: ReviewKeptFileList = {
    id: 'PR_7',
    headRefOid: 'h',
    baseRefOid: 'b',
    changedFiles: 1,
    files: [
        {
            path: 'secret.ts',
            previousPath: null,
            changeType: 'MODIFIED',
            additions: 1,
            deletions: 2,
            viewed: 'VIEWED',
        },
    ],
};

const THREADS: readonly ReviewThread[] = [
    {
        id: 'T1',
        path: 'secret.ts',
        line: 1,
        startLine: null,
        originalLine: 1,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        comments: [],
    },
];

const STATE: ReviewKeptState = {
    position: { place: { kind: 'line', path: 'secret.ts', side: 'after', line: 47 }, offset: -3 },
    collapseChoices: new Map([['secret.ts', false]]),
    filter: { pattern: 'secret', regex: false },
    hideViewed: true,
    expandedLines: new Map([['secret.ts', { oid: 'o1', lines: [{ start: 0, end: 20 }] }]]),
    openThreads: new Set(['T1']),
};

test('what is written is read back by another tab; a login reads nothing of another login', async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const tab = ReviewBlobStore.create();
    await tab.read(alice, []);

    await tab.write(alice, [{ oid: 'a1', text: 'secret' }]);

    expect(await ReviewBlobStore.create().read(alice, ['a1', 'a2'])).toEqual(new Map([['a1', 'secret']]));
    expect(await tab.read(bob, ['a1'])).toEqual(new Map());
});

test('a database of an older layout keeps its contents, which never change, and gains the stores it lacks', async () => {
    const login = uniqueLogin();
    const old = await openDB(getReviewBlobDatabaseName(login), 1, {
        upgrade(db) {
            db.createObjectStore('blobs', { keyPath: 'oid' });
            db.createObjectStore('fileLists');
        },
    });
    await old.put('blobs', { oid: 'a1', text: 'costly to read again' });
    old.close();

    const tab = ReviewBlobStore.create();

    expect(await tab.read(login, ['a1'])).toEqual(new Map([['a1', 'costly to read again']]));
    expect(await tab.readThreads(login, 'acme/web#7')).toBeUndefined();
    await tab.writeThreads(login, 'acme/web#7', []);
    expect(await tab.readThreads(login, 'acme/web#7')).toEqual([]);
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

test('file lists, threads, what the user did, resolutions and merge bases are per login, go with the local copy, and no late write brings them back', async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const tab = ReviewBlobStore.create();
    await tab.read(alice, []);
    const resolution: ReviewKeptResolution = { kind: 'blob', oid: 'o1', byteSize: 3, isBinary: false };
    const answers = new Map<string, ReviewKeptResolution>([
        ['acme/web:c1:secret.ts', resolution],
        ['acme/web:c1:gone.ts', { kind: 'noBlob' }],
    ]);
    await tab.writeResolutions(alice, answers);
    await tab.writeMergeBase(alice, 'acme/web:b...h', 'fork');
    await tab.writeFileList(alice, 'acme/web/7', FILE_LIST);
    await tab.writeThreads(alice, 'acme/web/7', THREADS);
    await tab.writeState(alice, 'acme/web/7', STATE);

    const another = ReviewBlobStore.create();
    expect(await another.readResolutions(alice, ['acme/web:c1:secret.ts', 'acme/web:c1:gone.ts', 'x'])).toEqual(
        answers,
    );
    expect(await another.readMergeBase(alice, 'acme/web:b...h')).toBe('fork');
    expect(await another.readFileList(alice, 'acme/web/7')).toEqual(FILE_LIST);
    expect(await another.readThreads(alice, 'acme/web/7')).toEqual(THREADS);
    expect(await tab.readFileList(bob, 'acme/web/7')).toBeUndefined();
    expect(await tab.readThreads(bob, 'acme/web/7')).toBeUndefined();
    expect(await another.readState(alice, 'acme/web/7')).toEqual(STATE);
    expect(await tab.readState(bob, 'acme/web/7')).toBeUndefined();

    await createIndexedDbPersistence().destroy(alice);

    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(alice));
    await expect(tab.writeResolutions(alice, answers)).rejects.toThrow();
    await expect(tab.writeMergeBase(alice, 'acme/web:b...h', 'fork')).rejects.toThrow();
    await expect(another.writeFileList(alice, 'acme/web/7', FILE_LIST)).rejects.toThrow();
    await expect(another.writeThreads(alice, 'acme/web/7', THREADS)).rejects.toThrow();
    await expect(another.writeState(alice, 'acme/web/7', STATE)).rejects.toThrow();
    expect(await databaseNames()).not.toContain(getReviewBlobDatabaseName(alice));

    expect(await tab.readFileList(alice, 'acme/web/7')).toBeUndefined();
    expect(await tab.readThreads(alice, 'acme/web/7')).toBeUndefined();
    expect(await tab.readState(alice, 'acme/web/7')).toBeUndefined();
    expect(await tab.readMergeBase(alice, 'acme/web:b...h')).toBeUndefined();
    expect(await tab.readResolutions(alice, ['acme/web:c1:secret.ts'])).toEqual(new Map());
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
