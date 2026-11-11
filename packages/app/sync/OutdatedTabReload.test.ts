/// <reference types="bun" />
// IndexedDB for bun: the newer githq opens the same database as the tab under test.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { deleteDB, openDB } from 'idb';

import { CommentDrafts } from '@/edits/CommentDrafts.js';
import { EditQueue } from '@/edits/EditQueue.js';
import type { Edit } from '@/edits/EditTypes.js';
import { getLocalDatabaseName, LOCAL_DATABASE_VERSION } from '@/store/IndexedDbPersistence.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { OutdatedTabReload } from './OutdatedTabReload.js';
import { ReloadHolds } from './ReloadHolds.js';

test('a newer githq opening the local copy reloads the tab', async () => {
    const { session, login } = await openTab();
    expect(session.reloads).toBe(0);

    await openNewerGithq(login);
    await session.clock.advance(1000);

    expect(session.reloads).toBe(1);
});

test('another tab signing out deletes the copy without reloading this one', async () => {
    const { session, login } = await openTab();

    await deleteDB(getLocalDatabaseName(login));
    await session.clock.advance(60_000);

    expect(session.reloads).toBe(0);
});

test('a comment being written holds the reload until it is gone', async () => {
    const { session, login } = await openTab();
    const drafts = session.container.resolve(CommentDrafts);
    drafts.set('I_1', 'Half a thought');

    await openNewerGithq(login);
    await session.clock.advance(60_000);
    expect(session.reloads).toBe(0);

    drafts.set('I_1', '');
    await session.clock.advance(1000);
    expect(session.reloads).toBe(1);
});

test('an edit on its way holds the reload until GitHub answered, and its failure until it is dismissed', async () => {
    const { session, login } = await openTab();
    const queue = session.container.resolve(EditQueue);
    let answer = (_error: Error) => {};
    const sent = new Promise<never>((_resolve, reject) => {
        answer = reject;
    });
    const edit: Edit = {
        itemId: 'I_1',
        reference: 'acme/web#1',
        subject: { kind: 'reopened' },
        optimistic: { item: item => item },
        send: () => sent,
    };
    const submitted = queue.submit({ edits: [edit], account: { login, token: `gho_${login}` }, itemCount: 1 });
    await session.clock.advance(0);
    expect(queue.pending).toHaveLength(1);

    await openNewerGithq(login);
    await session.clock.advance(60_000);
    expect(session.reloads).toBe(0);

    answer(new Error('GitHub said no'));
    await submitted;
    await session.clock.advance(60_000);
    expect(session.reloads).toBe(0);

    const failure = queue.failures[0];
    expect(failure).toBeDefined();
    queue.dismiss(failure?.id ?? -1);
    await session.clock.advance(1000);
    expect(session.reloads).toBe(1);
});

test('text a component holds keeps the tab from reloading until it lets go', async () => {
    const { session, login } = await openTab();
    const release = session.container.resolve(ReloadHolds).holdWhile(() => true);

    await openNewerGithq(login);
    await session.clock.advance(60_000);
    expect(session.reloads).toBe(0);

    release();
    await session.clock.advance(1000);
    expect(session.reloads).toBe(1);
});

async function openTab() {
    const login = uniqueLogin();
    const session = createTestSession({ login, answer: () => ({ data: {} }) });
    setIndexedDbPersistence(session.container);
    session.container.resolve(OutdatedTabReload);
    await session.container.resolve(ItemStore).ready();
    return { session, login };
}

async function openNewerGithq(login: string) {
    const newer = await openDB(getLocalDatabaseName(login), LOCAL_DATABASE_VERSION + 1);
    newer.close();
}
