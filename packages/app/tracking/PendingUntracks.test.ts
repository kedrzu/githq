/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { PendingUntracks } from './PendingUntracks.js';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedProject, TrackedRepository, TrackedTarget } from './TrackingTypes.js';

const WEB: TrackedRepository = { nameWithOwner: 'acme/web', id: 'R_web' };
const API: TrackedRepository = { nameWithOwner: 'acme/api', id: 'R_api' };
const ROADMAP: TrackedProject = { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' };

const WEB_TARGET: TrackedTarget = { kind: 'repository', nameWithOwner: WEB.nameWithOwner };
const API_TARGET: TrackedTarget = { kind: 'repository', nameWithOwner: API.nameWithOwner };
const ROADMAP_TARGET: TrackedTarget = { kind: 'project', id: ROADMAP.id };

test('while pending the entry is gone from what the app lists, and nothing is written, dropped or told', async () => {
    const { pending, tracking, untracked, keptSettings } = await open();
    await tracking.updateSyncState(WEB_TARGET, { phase: 'done' });
    const document = tracking.document;
    const kept = keptSettings();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.untrack(ROADMAP_TARGET, ROADMAP.title);

    expect(pending.isPending(WEB_TARGET)).toBe(true);
    expect(pending.isPending(API_TARGET)).toBe(false);
    expect(pending.repositories).toEqual([API]);
    expect(pending.projects).toEqual([]);

    // Anything not tracked is evicted by the next poll, and a `done` sync state would keep the copy from coming back.
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(tracking.repositories).toEqual([WEB, API]);
    expect(tracking.document).toBe(document);
    expect(tracking.getSyncState(WEB_TARGET)?.phase).toBe('done');
    expect(keptSettings()).toBe(kept);
    expect(untracked).toEqual([]);
});

test('committing — its toast closed — untracks at once, exactly once', async () => {
    const { pending, tracking, untracked } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.commit(WEB_TARGET);
    expect(tracking.isTracked(WEB_TARGET)).toBe(false);
    expect(pending.entries).toEqual([]);
    expect(untracked).toEqual([WEB_TARGET]);

    // Tracked again: a second commit of the same entry must not untrack it.
    tracking.track({ repository: WEB });
    pending.commit(WEB_TARGET);
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(untracked).toEqual([WEB_TARGET]);
});

test('nothing commits by itself: it waits for its toast', async () => {
    const { pending, tracking, session } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    await session.clock.advance(60_000);

    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(pending.isPending(WEB_TARGET)).toBe(true);
});

test('committing what is not pending does nothing', async () => {
    const { pending, tracking, untracked } = await open();

    pending.commit(WEB_TARGET);

    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(untracked).toEqual([]);
});

test('the page hiding commits everything pending, kept for the next load', async () => {
    const { pending, tracking, untracked, session, login } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.untrack(ROADMAP_TARGET, ROADMAP.title);
    session.tab.close();

    expect(untracked).toEqual([WEB_TARGET, ROADMAP_TARGET]);
    expect(pending.entries).toEqual([]);
    expect(tracking.isTracked(API_TARGET)).toBe(true);

    const { tracking: reloaded } = await open({ login, localStorage: session.localStorage, choose: false });
    expect(reloaded.repositories).toEqual([API]);
    expect(reloaded.projects).toEqual([]);
});

test('Undo forgets it with no write: nothing to download again, and its commit does nothing', async () => {
    const { pending, tracking, untracked, keptSettings } = await open();
    await tracking.updateSyncState(WEB_TARGET, { phase: 'done' });
    const kept = keptSettings();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.undo(WEB_TARGET);

    expect(pending.isPending(WEB_TARGET)).toBe(false);
    expect(pending.entries).toEqual([]);
    expect(pending.repositories).toEqual([WEB, API]);

    pending.commit(WEB_TARGET);
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(tracking.getSyncState(WEB_TARGET)?.phase).toBe('done');
    expect(keptSettings()).toBe(kept);
    expect(untracked).toEqual([]);
});

test('several pending are each kept, oldest first, and each commits or undoes on its own', async () => {
    const { pending, tracking } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.untrack(API_TARGET, API.nameWithOwner);
    expect(pending.entries).toEqual([
        { target: WEB_TARGET, label: WEB.nameWithOwner },
        { target: API_TARGET, label: API.nameWithOwner },
    ]);

    pending.undo(API_TARGET);
    expect(pending.entries).toEqual([{ target: WEB_TARGET, label: WEB.nameWithOwner }]);
    pending.commit(WEB_TARGET);
    expect(tracking.isTracked(WEB_TARGET)).toBe(false);
    expect(tracking.isTracked(API_TARGET)).toBe(true);
});

test('untracking again what is pending changes nothing: it keeps its place', async () => {
    const { pending } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    pending.untrack(API_TARGET, API.nameWithOwner);
    pending.untrack(WEB_TARGET, WEB.nameWithOwner);

    expect(pending.entries.map(entry => entry.target)).toEqual([WEB_TARGET, API_TARGET]);
});

test('what is not tracked does not become pending', async () => {
    const { pending } = await open();

    pending.untrack({ kind: 'repository', nameWithOwner: 'acme/other' }, 'acme/other');

    expect(pending.entries).toEqual([]);
});

test('untracked meanwhile in this tab, the pending entry goes without a second untrack', async () => {
    const { pending, tracking, untracked } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    tracking.untrack(WEB_TARGET);

    expect(pending.isPending(WEB_TARGET)).toBe(false);
    expect(pending.entries).toEqual([]);

    pending.commit(WEB_TARGET);
    expect(untracked).toEqual([WEB_TARGET]);
});

test('untracked meanwhile in another tab, the pending entry goes and its commit writes nothing', async () => {
    const tabs = createTestTabs();
    const here = await open({ tabs });
    const there = await open({ tabs, login: here.login, localStorage: here.session.localStorage, choose: false });

    here.pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    there.tracking.untrack(WEB_TARGET);
    await here.session.clock.advance(0);

    expect(here.tracking.isTracked(WEB_TARGET)).toBe(false);
    expect(here.pending.isPending(WEB_TARGET)).toBe(false);
    expect(here.pending.entries).toEqual([]);

    const kept = here.keptSettings();
    here.pending.commit(WEB_TARGET);
    expect(here.keptSettings()).toBe(kept);
    expect(here.untracked).toEqual([]);
});

test('another account signing in forgets what is pending: no commit writes into its settings', async () => {
    const { pending, tracking, session } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    session.signInFromAnotherTab(`user-${crypto.randomUUID()}`);
    expect(pending.entries).toEqual([]);

    await tracking.ready();
    // The new account tracks the same repository: the first account's untrack must not reach it.
    tracking.track({ repository: WEB });
    pending.commit(WEB_TARGET);

    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    expect(pending.isPending(WEB_TARGET)).toBe(false);
});

test('signing out forgets what is pending', async () => {
    const { pending, session, untracked } = await open();

    pending.untrack(WEB_TARGET, WEB.nameWithOwner);
    session.signOutFromAnotherTab();
    expect(pending.entries).toEqual([]);

    pending.commit(WEB_TARGET);
    expect(untracked).toEqual([]);
});

interface OpenOptions {
    readonly login?: string;
    readonly localStorage?: Map<string, string>;
    readonly tabs?: TestTabs;
    /** Whether to choose the sample's repositories and project; a reloaded tab finds them kept. */
    readonly choose?: boolean;
}

/** A tab signed in tracking `acme/web`, `acme/api` and the project Roadmap. */
async function open(options: OpenOptions = {}) {
    const login = options.login ?? `user-${crypto.randomUUID()}`;
    const session = createTestSession({
        login,
        answer: () => undefined,
        localStorage: options.localStorage,
        tabs: options.tabs,
    });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    await tracking.ready();
    if (options.choose !== false) {
        tracking.choose({ repositories: [WEB, API], projects: [ROADMAP] });
    }

    const untracked: TrackedTarget[] = [];
    tracking.onUntrack(target => untracked.push(target));

    return {
        session,
        tracking,
        login,
        untracked,
        pending: session.container.resolve(PendingUntracks),
        keptSettings: () => session.localStorage.get(`githq.settings.${login}`),
    };
}
