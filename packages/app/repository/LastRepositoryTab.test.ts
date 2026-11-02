/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { LastRepositoryTab } from './LastRepositoryTab.js';

test('a repository keeps its own tab, for the user on it, until they sign out', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const tabs = session.container.resolve(LastRepositoryTab);

    tabs.remember('octocat/app', 'pullRequests');
    tabs.remember('octocat/docs', 'issues');
    expect(tabs.get('octocat/app')).toBe('pullRequests');
    expect(tabs.get('octocat/docs')).toBe('issues');
    expect(tabs.get('octocat/other')).toBeNull();

    session.signInFromAnotherTab('hubot');
    expect(tabs.get('octocat/app')).toBeNull();
    session.signInFromAnotherTab('octocat');
    expect(tabs.get('octocat/app')).toBe('pullRequests');

    session.signOutFromAnotherTab();
    session.signInFromAnotherTab('octocat');
    expect(tabs.get('octocat/app')).toBeNull();
});

test('a repository no longer tracked opens on All, not on the Workflows tab it was left on', async () => {
    const session = createTestSession({ login: uniqueLogin(), answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const tracking = session.container.resolve(TrackingStore);
    const tabs = session.container.resolve(LastRepositoryTab);
    await tracking.ready();
    tracking.choose({ repositories: [{ nameWithOwner: 'octocat/app', id: 'R_app' }], projects: [] });

    tabs.remember('octocat/app', 'workflows');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/actions');

    tracking.untrack({ kind: 'repository', nameWithOwner: 'octocat/app' });
    expect(tabs.get('octocat/app')).toBeNull();
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app');
});

test("a repository's link opens the tab it was left on, its own address before it has one", () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    setIndexedDbPersistence(session.container);
    const tabs = session.container.resolve(LastRepositoryTab);

    expect(tabs.getPath('octocat/app')).toBe('/octocat/app');
    tabs.remember('octocat/app', 'issues');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/issues');
    tabs.remember('octocat/app', 'pullRequests');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app/pulls');
    tabs.remember('octocat/app', 'all');
    expect(tabs.getPath('octocat/app')).toBe('/octocat/app');
});

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
