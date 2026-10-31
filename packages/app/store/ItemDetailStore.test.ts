/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own logins, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { IssueDetailFieldsFragment } from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import type { Freshness } from '@/sync/Freshness.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession, TEST_START } from '@/testing/createTestSession.js';
import { sampleIssueDetailNode } from '@/testing/sampleDetailNodes.js';

import { createIndexedDbPersistence, getLocalDatabaseName } from './IndexedDbPersistence.js';
import { ItemDetailPersistence } from './ItemDetailPersistence.js';
import { ItemDetailStore } from './ItemDetailStore.js';
import { ItemPersistence } from './ItemPersistence.js';
import { ItemStore } from './ItemStore.js';
import { toItem } from './toItem.js';

const MONDAY = '2026-10-26T10:00:00Z';
const TUESDAY = '2026-10-27T10:00:00Z';

test('an opened item shows its kept detail at once; one behind its item is read again in the background and replaces it', async () => {
    const login = uniqueLogin();
    const before = setup(login);
    before.github.nodes.set('I_moved', sampleIssueDetailNode('I_moved', MONDAY));
    before.github.nodes.set('I_same', sampleIssueDetailNode('I_same', MONDAY));
    await before.items.ready();
    before.items.upsertMany([row('I_moved', MONDAY), row('I_same', MONDAY)]);
    await Promise.all([before.details.ensure('I_moved'), before.details.ensure('I_same')]);
    await before.items.flush();
    await before.session.clock.advance(0);

    // A reload; meanwhile one of the issues was edited, and the sync has read its row again.
    const after = setup(login);
    const held = createPromise();
    after.session.github.hold = held.promise;
    after.github.nodes.set('I_moved', { ...sampleIssueDetailNode('I_moved', TUESDAY), body: 'Edited' });
    await after.items.ready();
    after.items.upsertMany([row('I_moved', TUESDAY)]);

    const opened = Promise.all([after.details.ensure('I_moved'), after.details.ensure('I_same')]);
    await after.session.clock.advance(0);

    // Shown from the copy while GitHub has not answered.
    expect(after.details.get('I_moved')?.body).toBe('Body of I_moved');
    expect(after.details.get('I_same')?.body).toBe('Body of I_same');
    const checking: Freshness = { kind: 'checking', since: TEST_START };
    expect(after.details.getFreshness('I_moved')).toEqual(checking);
    const fresh: Freshness = { kind: 'fresh', checkedAt: TEST_START };
    expect(after.details.getFreshness('I_same')).toEqual(fresh);
    // Only the one behind is asked for.
    expect(after.requested('ItemDetail')).toEqual(['I_moved']);

    held.resolve();
    await opened;

    expect(after.details.get('I_moved')?.body).toBe('Edited');
    expect(after.details.getFreshness('I_moved').kind).toBe('fresh');
});

test("an item outside my work is loading until its detail comes, and its row comes with it without joining the user's items", async () => {
    const { details, items, github, session } = setup(uniqueLogin());
    github.nodes.set('I_elsewhere', sampleIssueDetailNode('I_elsewhere', MONDAY));
    const held = createPromise();
    session.github.hold = held.promise;

    const opened = details.ensure('I_elsewhere');
    await session.clock.advance(0);
    expect(details.getFreshness('I_elsewhere')).toEqual({ kind: 'partial' });
    expect(details.getItem('I_elsewhere')).toBeUndefined();

    held.resolve();
    await opened;

    expect(details.getItem('I_elsewhere')).toEqual(row('I_elsewhere', MONDAY));
    expect(items.get('I_elsewhere')).toBeUndefined();
    expect(details.getFreshness('I_elsewhere').kind).toBe('fresh');

    // GitHub will not show another one: no detail, and the segment says so instead of loading forever.
    await details.ensure('I_hidden');
    const expected: Freshness = { kind: 'stale', since: null, reason: 'failing' };
    expect(details.getFreshness('I_hidden')).toEqual(expected);
});

test('another account taking over in another tab: the details leave memory and disk, and an answer still on its way is not kept for the new one', async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const { details, items, github, session } = setup(alice);
    github.nodes.set('I_1', sampleIssueDetailNode('I_1', MONDAY));
    github.nodes.set('I_2', sampleIssueDetailNode('I_2', MONDAY));
    await details.ensure('I_1');
    await session.clock.advance(0);

    const held = createPromise();
    session.github.hold = held.promise;
    const late = details.ensure('I_2');
    await session.clock.advance(0);
    expect(github.requests.at(-1)?.token).toBe(`gho_${alice}`);

    session.signInFromAnotherTab(bob);

    expect(details.get('I_1')).toBeUndefined();
    await waitUntil(async () => !(await databaseNames()).includes(getLocalDatabaseName(alice)), {
        timeoutMs: 2000,
    });

    held.resolve();
    await late;
    await items.ready();
    await details.ready();
    await session.clock.advance(0);

    expect(details.get('I_2')).toBeUndefined();
    // Nothing of Alice's in Bob's copy either.
    expect(details.needsFetch('I_2')).toBe(true);
    expect(await databaseNames()).not.toContain(getLocalDatabaseName(alice));
});

test('older comments go before the ones read; reading the item again keeps them', async () => {
    const { details, github, session } = setup(uniqueLogin());
    github.nodes.set('I_1', withComments(sampleIssueDetailNode('I_1', MONDAY), 51, 100));
    await details.ensure('I_1');

    await details.loadOlderComments('I_1');

    expect(github.requests.at(-1)?.variables).toEqual({ id: 'I_1', before: 'cursor-51' });
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(commentIds(1, 100));
    expect(details.get('I_1')?.comments.olderCursor).toBeNull();

    // A new comment; opened again later, the newest page is read again.
    github.nodes.set('I_1', withComments(sampleIssueDetailNode('I_1', TUESDAY), 52, 101));
    await session.clock.advance(2 * 60_000);
    await details.ensure('I_1');

    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(commentIds(1, 101));
    expect(details.get('I_1')?.comments.olderCursor).toBeNull();
});

function setup(login: string) {
    const nodes = new Map<string, IssueDetailFieldsFragment>();
    const session = createTestSession({ login, answer });
    const persistence = createIndexedDbPersistence();
    session.container.set(ItemPersistence, persistence);
    session.container.set(ItemDetailPersistence, persistence);
    const items = session.container.resolve(ItemStore);
    const details = session.container.resolve(ItemDetailStore);

    return {
        session,
        items,
        details,
        github: { nodes, requests: session.github.requests },
        /** The ids each call of `operation` asked for. */
        requested: (operation: string) =>
            session.github.requests
                .filter(request => request.operation === operation)
                .map(request => request.variables.id),
    };

    /** As GitHub answers: an issue it knows, else `null` with `NOT_FOUND`. */
    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        const id = String(request.variables.id);
        const node = nodes.get(id) ?? null;
        switch (request.operation) {
            case 'ItemDetail':
                return node
                    ? { data: { node } }
                    : { data: { node: null }, errors: [{ type: 'NOT_FOUND', path: ['node'], message: 'Not found' }] };
            case 'MoreComments': {
                const before = Number(String(request.variables.before).replace('cursor-', ''));
                return { data: { node: { id, commentPage: commentPage(1, before - 1) } } };
            }
            default:
                return undefined;
        }
    }
}

function row(id: string, updatedAt: string) {
    const item = toItem(sampleIssueDetailNode(id, updatedAt));
    if (!item) {
        throw new Error('An issue always makes a row');
    }

    return item;
}

/** The issue with comments `from`–`to` as its newest page; older ones before `from`. */
function withComments(node: IssueDetailFieldsFragment, from: number, to: number): IssueDetailFieldsFragment {
    return { ...node, commentPage: commentPage(from, to) };
}

function commentPage(from: number, to: number): IssueDetailFieldsFragment['commentPage'] {
    return {
        totalCount: to,
        pageInfo: { hasPreviousPage: from > 1, startCursor: `cursor-${from}` },
        nodes: commentIds(from, to).map(id => ({
            id,
            url: `https://github.com/acme/web/issues/1#${id}`,
            createdAt: MONDAY,
            lastEditedAt: null,
            author: null,
            bodyHTML: `<p>${id}</p>`,
        })),
    };
}

function commentIds(from: number, to: number) {
    return Array.from({ length: to - from + 1 }, (_, index) => `IC_${from + index}`);
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}
