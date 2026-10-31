/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { AuthStore } from '@/auth/AuthStore.js';
import { Browser } from '@/services/Browser.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { ListViewOptionsStore } from './ListViewOptionsStore.js';

test("a list's options are kept for the user who changed them, and forgotten when they sign out", () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const store = session.container.resolve(ListViewOptionsStore);
    const storage = session.container.resolve(Browser).localStorage;

    store.set('repository:acme/secret', { layout: 'board' });
    expect(store.get('repository:acme/secret')).toEqual({ layout: 'board' });
    expect(storage.getItem('githq.listViews.octocat')).toBe(
        JSON.stringify({ 'repository:acme/secret': { layout: 'board' } }),
    );

    // Another user in this browser has none of them; the first gets theirs back.
    session.signInFromAnotherTab('hubot');
    expect(store.has('repository:acme/secret')).toBe(false);
    session.signInFromAnotherTab('octocat');
    expect(store.get('repository:acme/secret')).toEqual({ layout: 'board' });

    store.set('repository:acme/secret', null);
    expect(store.has('repository:acme/secret')).toBe(false);
    store.set('myWork', { sort: 'title' });

    // The lists name the account's repositories and projects: nothing of them stays in the browser.
    session.container.resolve(AuthStore).signOut();
    expect(storage.getItem('githq.listViews.octocat')).toBeNull();
    expect(store.has('myWork')).toBe(false);
});

test('two tabs change the options of different lists: neither undoes the other, and each shows what the other changed', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const store = session.container.resolve(ListViewOptionsStore);
    const storage = session.container.resolve(Browser).localStorage;
    store.set('myWork', { sort: 'title' });

    // Another tab, which read the options before that, changes another list's; its `storage` event is not here yet.
    storage.setItem('githq.listViews.octocat', JSON.stringify({ 'repository:acme/api': { layout: 'board' } }));
    store.set('myWork', { sort: 'updated' });

    const expected = { 'repository:acme/api': { layout: 'board' }, myWork: { sort: 'updated' } };
    expect(JSON.parse(storage.getItem('githq.listViews.octocat') ?? 'null')).toEqual(expected);
    expect(store.get('repository:acme/api')).toEqual({ layout: 'board' });

    // It changes it again, and this tab hears of it.
    session.fromAnotherTab({
        'githq.listViews.octocat': JSON.stringify({ ...expected, 'repository:acme/api': { layout: 'list' } }),
    });
    expect(store.get('repository:acme/api')).toEqual({ layout: 'list' });
    expect(store.get('myWork')).toEqual({ sort: 'updated' });
});

test('what an older githq kept per list, for every user, is deleted; a kept value that is not JSON is ignored', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.listView.myWork', JSON.stringify({ sort: 'title' }));
    storage.setItem('githq.listView.repository:acme/api', JSON.stringify({ layout: 'board' }));
    storage.setItem('githq.listViews.octocat', '{not json');
    storage.setItem('githq.sidebarCollapsed', 'true');

    const store = session.container.resolve(ListViewOptionsStore);

    expect(storage.getItem('githq.listView.myWork')).toBeNull();
    expect(storage.getItem('githq.listView.repository:acme/api')).toBeNull();
    expect(storage.getItem('githq.sidebarCollapsed')).toBe('true');
    expect(store.has('myWork')).toBe(false);

    store.set('myWork', { sort: 'title' });
    expect(storage.getItem('githq.listViews.octocat')).toBe(JSON.stringify({ myWork: { sort: 'title' } }));
});
