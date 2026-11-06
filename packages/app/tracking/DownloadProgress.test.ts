/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { DownloadProgress } from './DownloadProgress.js';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedProject, TrackedRepository, TrackedTarget } from './TrackingTypes.js';

const WEB: TrackedRepository = { nameWithOwner: 'acme/web', id: 'R_web' };
const API: TrackedRepository = { nameWithOwner: 'acme/api', id: 'R_api' };
const ROADMAP: TrackedProject = { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' };

const WEB_TARGET = { kind: 'repository', nameWithOwner: WEB.nameWithOwner } satisfies TrackedTarget;
const API_TARGET = { kind: 'repository', nameWithOwner: API.nameWithOwner } satisfies TrackedTarget;
const ROADMAP_TARGET = { kind: 'project', id: ROADMAP.id } satisfies TrackedTarget;

test('nothing tracked, nothing to tell', async () => {
    const { download } = await open();
    expect(download.current).toBeNull();
});

test('sums every tracked repository and project, the total unknown while any has not counted, hidden ones left out', async () => {
    const { download, tracking } = await open();
    tracking.choose({ repositories: [WEB, API], projects: [ROADMAP] });

    // Nothing counted yet: "Downloading · counting…".
    expect(download.current).toEqual({ done: 0, total: null, secondsLeft: null, repositories: 2, projects: 1 });

    await tracking.updateSyncState(WEB_TARGET, { counts: { openIssues: { done: 100, total: 400 } } });
    await tracking.updateSyncState(ROADMAP_TARGET, { count: { done: 20, total: 50 } });
    expect(download.current).toMatchObject({ done: 120, total: null });

    // GitHub doesn't show `acme/api`: it never holds the total back, nor counts as downloading.
    await tracking.updateSyncState(API_TARGET, { hidden: true });
    expect(download.current).toEqual({ done: 120, total: 450, secondsLeft: null, repositories: 1, projects: 1 });

    await tracking.updateSyncState(ROADMAP_TARGET, { downloaded: true, count: { done: 50, total: 50 } });
    expect(download.current).toMatchObject({ done: 150, total: 450, repositories: 1, projects: 0 });
});

test('everything arrived, nothing to tell — also with a hidden repository never read', async () => {
    const { download, tracking } = await open();
    tracking.choose({ repositories: [WEB, API], projects: [] });
    await tracking.updateSyncState(API_TARGET, { hidden: true });

    await tracking.updateSyncState(WEB_TARGET, { phase: 'done', counts: { openIssues: { done: 4, total: 4 } } });
    expect(download.current).toBeNull();
});

test('the time left is told only after five seconds of pace, from when the download was first seen under way', async () => {
    const { download, tracking, session } = await open();
    tracking.choose({ repositories: [WEB], projects: [] });
    await tracking.updateSyncState(WEB_TARGET, { counts: { openIssues: { done: 0, total: 1000 } } });

    await session.clock.advance(4000);
    await tracking.updateSyncState(WEB_TARGET, { counts: { openIssues: { done: 80, total: 1000 } } });
    expect(download.current?.secondsLeft).toBeNull();

    // 100 items in 5 s: the 900 left take 45 s.
    await session.clock.advance(1000);
    await tracking.updateSyncState(WEB_TARGET, { counts: { openIssues: { done: 100, total: 1000 } } });
    expect(download.current?.secondsLeft).toBe(45);
});

test('a download that starts after everything arrived counts its pace afresh', async () => {
    const { download, tracking, session } = await open();
    tracking.choose({ repositories: [WEB], projects: [] });
    await tracking.updateSyncState(WEB_TARGET, { phase: 'done', counts: { openIssues: { done: 500, total: 500 } } });
    expect(download.current).toBeNull();

    // A minute idle must not dilute the new download's pace.
    await session.clock.advance(60_000);
    tracking.track({ repository: API });
    await tracking.updateSyncState(API_TARGET, { counts: { openIssues: { done: 0, total: 200 } } });
    await session.clock.advance(5000);
    await tracking.updateSyncState(API_TARGET, { counts: { openIssues: { done: 100, total: 200 } } });

    expect(download.current).toEqual({ done: 600, total: 700, secondsLeft: 5, repositories: 1, projects: 0 });
});

/** A tab signed in with its local copy open and the kept choice read. */
async function open() {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer: () => undefined });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    await tracking.ready();
    const download = session.container.resolve(DownloadProgress);
    return { session, tracking, download };
}
