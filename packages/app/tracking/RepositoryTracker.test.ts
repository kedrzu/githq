/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { RepositoryTracker } from './RepositoryTracker.js';
import { TrackingStore } from './TrackingStore.js';

test("two runs while it is looked up track it once, by GitHub's id and own name", async () => {
    const { session, tracker, tracking } = await open(() => ({
        data: { repository: repositoryNode('acme/web') },
    }));
    const answered = createPromise();
    session.github.holdIf = () => answered.promise;

    const runs = [tracker.track('ACME/Web'), tracker.track('ACME/Web')];
    expect(tracking.repositories).toEqual([]);
    answered.resolve();
    await Promise.all(runs);

    expect(tracking.repositories).toEqual([{ nameWithOwner: 'acme/web', id: 'R_acme/web' }]);
    expect(tracker.failedName).toBeNull();
});

test('GitHub not showing it, or not answering, tracks nothing and says so until tried again or dismissed', async () => {
    let answer: TestGraphQLAnswer | undefined = { data: { repository: null } };
    const { tracker, tracking } = await open(() => answer);

    await tracker.track('acme/hidden');
    expect(tracking.repositories).toEqual([]);
    expect(tracker.failedName).toBe('acme/hidden');

    tracker.dismissFailure();
    expect(tracker.failedName).toBeNull();

    answer = undefined;
    await tracker.track('acme/web');
    expect(tracking.repositories).toEqual([]);
    expect(tracker.failedName).toBe('acme/web');

    answer = { data: { repository: repositoryNode('acme/web') } };
    await tracker.track('acme/web');
    expect(tracking.repositories).toEqual([{ nameWithOwner: 'acme/web', id: 'R_acme/web' }]);
    expect(tracker.failedName).toBeNull();
});

test("the user's own settings repository is not tracked", async () => {
    const login = `user-${crypto.randomUUID()}`;
    const { tracker, tracking } = await open(
        () => ({ data: { repository: repositoryNode(`${login}/githq-settings`) } }),
        login,
    );

    await tracker.track(`${login}/githq-settings`);

    expect(tracking.repositories).toEqual([]);
    expect(tracker.failedName).toBe(`${login}/githq-settings`);
});

test('signed out while it is looked up, nothing is tracked and no failure is left for whoever signs in next', async () => {
    const { session, tracker, tracking } = await open(() => ({
        data: { repository: repositoryNode('acme/web') },
    }));
    const answered = createPromise();
    session.github.holdIf = () => answered.promise;

    const run = tracker.track('acme/web');
    session.container.resolve(AuthStore).signOut();
    answered.resolve();
    await run;

    expect(tracking.repositories).toEqual([]);
    expect(tracker.failedName).toBeNull();
});

async function open(
    answer: (request: TestGraphQLRequest) => TestGraphQLAnswer | undefined,
    login = `user-${crypto.randomUUID()}`,
) {
    const session = createTestSession({ login, answer });
    setIndexedDbPersistence(session.container);
    const tracking = session.container.resolve(TrackingStore);
    await tracking.ready();
    return { session, tracking, tracker: session.container.resolve(RepositoryTracker) };
}

function repositoryNode(nameWithOwner: string) {
    return {
        id: `R_${nameWithOwner}`,
        nameWithOwner,
        isPrivate: false,
        isArchived: false,
        pushedAt: '2026-11-01T00:00:00Z',
        viewerPermission: 'READ',
        owner: { login: nameWithOwner.split('/')[0] },
        issues: { totalCount: 0 },
        pullRequests: { totalCount: 0 },
    };
}
