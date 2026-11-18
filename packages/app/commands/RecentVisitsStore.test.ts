/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { createTestSession } from '@/testing/createTestSession.js';

import type { RecentVisit } from './RecentVisitsStore.js';
import { RecentVisitsStore } from './RecentVisitsStore.js';

test('a visit goes first, one made again moves there, and only the last ten are kept', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const store = session.container.resolve(RecentVisitsStore);

    store.record({ kind: 'place', id: 'repository:acme/api' });
    store.record({ kind: 'item', id: 'I_1' });
    store.record({ kind: 'place', id: 'project:P_1' });
    store.record({ kind: 'place', id: 'repository:acme/api' });

    const expected: RecentVisit[] = [
        { kind: 'place', id: 'repository:acme/api' },
        { kind: 'place', id: 'project:P_1' },
        { kind: 'item', id: 'I_1' },
    ];
    expect(store.visits).toEqual(expected);

    for (let index = 2; index <= 12; index++) {
        store.record({ kind: 'item', id: `I_${index}` });
    }

    expect(store.visits).toHaveLength(10);
    expect(store.visits[0]).toEqual({ kind: 'item', id: 'I_12' });
    expect(store.visits.at(-1)).toEqual({ kind: 'item', id: 'I_3' });
});

test("the visits are kept for the user who made them, follow another tab's and are forgotten on sign-out", () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const store = session.container.resolve(RecentVisitsStore);
    const storage = session.container.resolve(Browser).localStorage;

    store.record({ kind: 'place', id: 'repository:acme/secret' });
    expect(storage.getItem('githq.recent.octocat')).toBe(
        JSON.stringify([{ kind: 'place', id: 'repository:acme/secret' }]),
    );

    // Another user in this browser has none of them; the first gets theirs back.
    session.signInFromAnotherTab('hubot');
    expect(store.visits).toEqual([]);
    session.signInFromAnotherTab('octocat');
    expect(store.visits).toEqual([{ kind: 'place', id: 'repository:acme/secret' }]);

    // Another tab visits an item; this one hears of it, and its next visit keeps both.
    session.fromAnotherTab({
        'githq.recent.octocat': JSON.stringify([
            { kind: 'item', id: 'I_1' },
            { kind: 'place', id: 'repository:acme/secret' },
        ]),
    });
    expect(store.visits[0]).toEqual({ kind: 'item', id: 'I_1' });
    store.record({ kind: 'place', id: 'project:P_1' });
    expect(store.visits).toEqual([
        { kind: 'place', id: 'project:P_1' },
        { kind: 'item', id: 'I_1' },
        { kind: 'place', id: 'repository:acme/secret' },
    ]);

    session.container.resolve(AuthStore).signOut();
    expect(storage.getItem('githq.recent.octocat')).toBeNull();
    expect(store.visits).toEqual([]);
});

test('what is kept and not understood is dropped', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem(
        'githq.recent.octocat',
        JSON.stringify([
            { kind: 'item', id: 'I_1' },
            { kind: 'screen', id: 'x' },
            { kind: 'place', id: 3 },
            null,
            'repository:acme/api',
            { kind: 'item', id: 'I_1' },
            { kind: 'place', id: 'project:P_1' },
        ]),
    );

    expect(session.container.resolve(RecentVisitsStore).visits).toEqual([
        { kind: 'item', id: 'I_1' },
        { kind: 'place', id: 'project:P_1' },
    ]);
});

test('a kept value that is not a list, or not JSON, is no visits', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.recent.octocat', '{not json');
    const store = session.container.resolve(RecentVisitsStore);
    expect(store.visits).toEqual([]);

    session.fromAnotherTab({ 'githq.recent.octocat': JSON.stringify({ kind: 'item', id: 'I_1' }) });
    expect(store.visits).toEqual([]);

    store.record({ kind: 'item', id: 'I_2' });
    expect(storage.getItem('githq.recent.octocat')).toBe(JSON.stringify([{ kind: 'item', id: 'I_2' }]));
});
