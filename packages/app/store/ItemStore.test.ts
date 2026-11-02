/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import type { Viewer } from '@/auth/AuthStore.js';
import { AuthStore, VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { createIndexedDbPersistence, getLocalDatabaseName } from './IndexedDbPersistence.js';
import type { ItemChanges } from './ItemPersistence.js';
import { ItemPersistence } from './ItemPersistence.js';
import { ItemStore } from './ItemStore.js';
import type { SyncLoopState } from './ItemStoreTypes.js';

const SYNCED: SyncLoopState = { lastAttemptAt: 2000, lastSuccessAt: 2000, lastError: null, incomplete: false };

test('a reload shows exactly what the last session kept — items, memberships, sync state — before GitHub answers anything', async () => {
    const login = uniqueLogin();
    const before = setup(login);
    await before.items.ready();

    before.items.upsertMany([sampleIssue('I_1'), sampleIssue('I_2'), sampleIssue('I_3')]);
    before.items.remove(['I_2']);
    before.items.upsertMany([{ ...sampleIssue('I_3'), title: 'Renamed' }]);
    before.items.setMembership('assigned', ['I_1', 'I_3']);
    before.items.setSyncState('myWork', SYNCED);
    // Written behind, all of it in one batch.
    await waitUntil(() => before.persistence.saves.length === 1, { timeoutMs: 2000 });

    // GitHub never answers this session.
    const after = setup(login);
    expect(after.items.loaded).toBe(false);
    await after.items.ready();

    expect(after.items.loaded).toBe(true);
    expect(after.items.all).toEqual([sampleIssue('I_1'), { ...sampleIssue('I_3'), title: 'Renamed' }]);
    expect(after.items.membership.assigned).toEqual(new Set(['I_1', 'I_3']));
    // A group whose search never answered has not arrived.
    expect(after.items.membership.reviewRequested).toBeUndefined();
    expect(after.items.getSyncState('myWork')).toEqual(SYNCED);
});

test("signing out deletes the user's copy and empties memory; the next user starts from their own", async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const { auth, items, fromAnotherTab } = setup(alice);
    await items.ready();
    items.upsertMany([sampleIssue('I_1')]);
    items.setMembership('authored', ['I_1']);
    await items.flush();

    auth.signOut();

    expect(items.all).toEqual([]);
    expect(items.membership).toEqual({});
    expect(items.loaded).toBe(false);
    await waitUntil(async () => !(await databaseNames()).includes(getLocalDatabaseName(alice)), { timeoutMs: 2000 });

    fromAnotherTab({ [TOKEN_KEY]: 'gho_bob', [VIEWER_KEY]: JSON.stringify(viewerOf(bob)) });
    await items.ready();

    expect(items.loaded).toBe(true);
    expect(items.all).toEqual([]);
    expect(items.get('I_1')).toBeUndefined();
    expect(await databaseNames()).not.toContain(getLocalDatabaseName(alice));
});

test("signing out in another tab deletes this tab's copy too, with the writes still waiting", async () => {
    const login = uniqueLogin();
    const { items, persistence, fromAnotherTab } = setup(login);
    await items.ready();
    items.upsertMany([sampleIssue('I_1')]);
    await items.flush();
    items.upsertMany([sampleIssue('I_2')]);

    fromAnotherTab({ [TOKEN_KEY]: null, [VIEWER_KEY]: null });

    expect(items.all).toEqual([]);
    await waitUntil(async () => !(await databaseNames()).includes(getLocalDatabaseName(login)), { timeoutMs: 2000 });
    // The batch with `I_2` was dropped, not written into a database brought back to life.
    await Bun.sleep(300);
    expect(persistence.saves).toHaveLength(1);
    expect(await databaseNames()).not.toContain(getLocalDatabaseName(login));
});

test('signed out, no copy is opened and nothing is kept', async () => {
    const { items, persistence } = setup(null);

    await items.ready();
    items.upsertMany([sampleIssue('I_1')]);
    await items.flush();

    expect(items.all).toEqual([]);
    expect(persistence.loads).toEqual([]);
    expect(persistence.saves).toEqual([]);
});

test('a write that fails leaves memory as it is, never throws, and is written with the next change', async () => {
    const login = uniqueLogin();
    const { items, persistence, logs } = setup(login);
    await items.ready();

    persistence.failSaves = true;
    items.upsertMany([sampleIssue('I_1')]);
    items.setMembership('mentioned', ['I_1']);
    await items.flush();

    expect(items.get('I_1')).toEqual(sampleIssue('I_1'));
    expect(items.membership.mentioned).toEqual(new Set(['I_1']));
    expect(logs.some(log => log.level === 'warn' && log.message.startsWith('Could not write the local copy'))).toBe(
        true,
    );

    persistence.failSaves = false;
    items.upsertMany([sampleIssue('I_2')]);
    await items.flush();

    const reloaded = setup(login);
    await reloaded.items.ready();
    expect(reloaded.items.all).toEqual([sampleIssue('I_1'), sampleIssue('I_2')]);
    expect(reloaded.items.membership.mentioned).toEqual(new Set(['I_1']));
});

test('a copy that cannot be read leaves an empty, working store', async () => {
    const persistence = recordingPersistence();
    persistence.failLoads = true;
    const { items } = setup(uniqueLogin(), persistence);

    await items.ready();
    items.upsertMany([sampleIssue('I_1')]);

    expect(items.loaded).toBe(true);
    expect(items.all).toEqual([sampleIssue('I_1')]);
});

test('a tab opening before another wrote its last changes gets them from it; a tab closed writes its changes at once', async () => {
    const tabs = createTestTabs();
    const login = uniqueLogin();
    const first = setup(login, recordingPersistence(), tabs);
    await first.items.ready();
    first.items.upsertMany([sampleIssue('I_1')]);
    first.items.setMembership('assigned', ['I_1']);

    // It reads the copy before the first tab's write: what it finds there lacks `I_1`.
    const second = setup(login, recordingPersistence(), tabs);
    await second.items.ready();
    await waitUntil(() => second.items.get('I_1') !== undefined, { timeoutMs: 1000 });
    expect(second.items.membership.assigned).toEqual(new Set(['I_1']));

    first.items.upsertMany([sampleIssue('I_2')]);
    first.tab.close();
    // Not after the write's usual delay: the page may be gone by then.
    await waitUntil(() => first.persistence.saves.some(save => save.upserted.some(item => item.id === 'I_2')), {
        timeoutMs: 100,
        intervalMs: 5,
    });
});

function setup(login: string | null, persistence = recordingPersistence(), tabs = createTestTabs()) {
    const local = new Map<string, string>();
    if (login !== null) {
        local.set(TOKEN_KEY, `gho_${login}`);
        local.set(VIEWER_KEY, JSON.stringify(viewerOf(login)));
    }

    const storageListeners: ((key: string | null) => void)[] = [];
    const tab = tabs.open();
    const browser: BrowserShape = {
        // GitHub never answers: whatever the store shows comes from the local copy.
        fetch: () => new Promise<Response>(() => {}),
        localStorage: {
            getItem: key => local.get(key) ?? null,
            setItem: (key, value) => {
                local.set(key, value);
            },
            removeItem: key => {
                local.delete(key);
            },
            key: index => [...local.keys()][index] ?? null,
            get length() {
                return local.size;
            },
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        origin: 'https://githq.test',
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        navigate: () => {},
        replaceLocation: () => {},
        openInNewTab: () => {},
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => true,
        onVisibilityChange: () => {},
        onFocus: () => {},
        isOnline: () => true,
        onOnlineChange: () => {},
        writeCookie: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...tab,
    };

    const { container, logs } = createTestContainer();
    container.set(Browser, browser);
    container.set(ItemPersistence, persistence);
    const auth = container.resolve(AuthStore);
    const items = container.resolve(ItemStore);

    /** Another tab writes `changes` (`null` removes a key), and this tab gets a `storage` event for each. */
    function fromAnotherTab(changes: Record<string, string | null>) {
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) {
                local.delete(key);
            } else {
                local.set(key, value);
            }
        }

        for (const key of Object.keys(changes)) {
            for (const listener of storageListeners) {
                listener(key);
            }
        }
    }

    return { auth, items, persistence, logs, tab, fromAnotherTab };
}

/** The IndexedDB persistence, recording what reaches it and failing on demand. */
function recordingPersistence() {
    const indexedDb = createIndexedDbPersistence();
    const loads: string[] = [];
    const saves: ItemChanges[] = [];
    const recorder = {
        loads,
        saves,
        failLoads: false,
        failSaves: false,
        load: async (login: string) => {
            recorder.loads.push(login);
            if (recorder.failLoads) {
                throw new Error('The disk is gone');
            }

            return await indexedDb.load(login);
        },
        save: async (login: string, changes: ItemChanges) => {
            if (recorder.failSaves) {
                throw new Error('Quota exceeded');
            }

            recorder.saves.push(changes);
            await indexedDb.save(login, changes);
        },
        destroy: (login: string) => indexedDb.destroy(login),
    };

    return recorder;
}

function viewerOf(login: string): Viewer {
    return { login, name: null, avatarUrl: `https://avatars.test/${login}` };
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}
