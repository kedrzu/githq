/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import { openDB } from 'idb';

import type { PersistedProjects } from '@/projects/ProjectPersistence.js';
import type { Project, ProjectItem } from '@/projects/ProjectTypes.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { sampleIssueDetailNode } from '@/testing/sampleDetailNodes.js';
import { sampleIssue } from '@/testing/sampleItems.js';

import { createIndexedDbPersistence, getLocalDatabaseName, LOCAL_DATABASE_VERSION } from './IndexedDbPersistence.js';
import type { ItemDetailVersion } from './ItemDetailPersistence.js';
import type { ItemDetail } from './ItemDetailTypes.js';
import type { PersistedItems } from './ItemPersistence.js';
import { toItemDetail } from './toItemDetail.js';

test('what is saved is what a later session loads, removals and memberships included', async () => {
    const login = uniqueLogin();
    const tab = createIndexedDbPersistence();
    await tab.load(login);

    await tab.save(login, {
        upserted: [sampleIssue('I_1'), sampleIssue('I_2')],
        removed: [],
        membership: { assigned: ['I_1', 'I_2'] },
        sync: { myWork: { lastAttemptAt: 1000, lastSuccessAt: 1000, lastError: null, incomplete: false } },
    });
    await tab.save(login, {
        upserted: [{ ...sampleIssue('I_1'), title: 'Renamed' }],
        removed: ['I_2'],
        membership: { assigned: ['I_1'], mentioned: [] },
        sync: null,
    });

    const reloaded = await createIndexedDbPersistence().load(login);

    const expected: PersistedItems = {
        items: [{ ...sampleIssue('I_1'), title: 'Renamed' }],
        membership: { assigned: ['I_1'], mentioned: [] },
        sync: { myWork: { lastAttemptAt: 1000, lastSuccessAt: 1000, lastError: null, incomplete: false } },
    };
    expect(reloaded).toEqual(expected);
});

test("one login's copy is not another's", async () => {
    const [alice, bob] = [uniqueLogin(), uniqueLogin()];
    const persistence = createIndexedDbPersistence();
    await persistence.load(alice);
    await persistence.save(alice, { upserted: [sampleIssue('I_1')], removed: [], membership: null, sync: null });

    const expected: PersistedItems = { items: [], membership: {}, sync: {} };
    expect(await persistence.load(bob)).toEqual(expected);
});

test('destroying deletes the database, even while another tab holds it open — and that tab does not write it back', async () => {
    const login = uniqueLogin();
    const otherTab = createIndexedDbPersistence();
    await otherTab.load(login);
    const thisTab = createIndexedDbPersistence();
    await thisTab.load(login);
    await thisTab.save(login, { upserted: [sampleIssue('I_1')], removed: [], membership: null, sync: null });

    await thisTab.destroy(login);

    expect(await databaseNames()).not.toContain(getLocalDatabaseName(login));
    // The other tab gave its connection up for the deletion; a late write of its own fails instead of
    // recreating the database.
    await expect(
        otherTab.save(login, { upserted: [sampleIssue('I_2')], removed: [], membership: null, sync: null }),
    ).rejects.toThrow();
    expect(await databaseNames()).not.toContain(getLocalDatabaseName(login));
});

test('a database of a newer githq is dropped and started again, not left failing every load', async () => {
    const login = uniqueLogin();
    const newer = await openDB(getLocalDatabaseName(login), LOCAL_DATABASE_VERSION + 1, {
        upgrade(db) {
            db.createObjectStore('somethingElse');
        },
    });
    newer.close();

    const persistence = createIndexedDbPersistence();
    const loaded = await persistence.load(login);
    await persistence.save(login, { upserted: [sampleIssue('I_1')], removed: [], membership: null, sync: null });

    const expected: PersistedItems = { items: [], membership: {}, sync: {} };
    expect(loaded).toEqual(expected);
    expect((await createIndexedDbPersistence().load(login)).items).toEqual([sampleIssue('I_1')]);
});

test("details and repository metadata are kept in the user's copy, the details' versions read without them; once the copy is deleted they fail instead of bringing it back", async () => {
    const login = uniqueLogin();
    const tab = createIndexedDbPersistence();
    await tab.load(login);
    const [kept, dropped] = [detail('I_1', 1000), detail('I_2', 2000)];
    await tab.saveDetails(login, [kept, dropped]);
    await tab.deleteDetails(login, ['I_2']);
    await tab.saveRepository(login, REPOSITORY);
    await tab.saveViewerProjects(login, { projects: [], fetchedAt: 3000 });

    const reloaded = createIndexedDbPersistence();
    await reloaded.load(login);
    const versions: ReadonlyMap<string, ItemDetailVersion> = new Map([
        ['I_1', { itemUpdatedAt: kept.item.updatedAt, fetchedAt: 1000 }],
    ]);
    expect(await reloaded.loadDetailVersions(login)).toEqual(versions);
    expect(await reloaded.loadDetail(login, 'I_1')).toEqual(kept);
    expect(await reloaded.loadDetail(login, 'I_2')).toBeNull();
    expect(await reloaded.loadRepositories(login)).toEqual({
        repositories: [REPOSITORY],
        viewerProjects: { projects: [], fetchedAt: 3000 },
    });

    await reloaded.destroy(login);

    expect(await databaseNames()).not.toContain(getLocalDatabaseName(login));
    await expect(tab.saveDetails(login, [kept])).rejects.toThrow();
    await expect(tab.saveRepository(login, REPOSITORY)).rejects.toThrow();
    await expect(tab.loadDetail(login, 'I_1')).rejects.toThrow();
    expect(await databaseNames()).not.toContain(getLocalDatabaseName(login));
});

const REPOSITORY: RepositoryMetadata = {
    nameWithOwner: 'acme/web',
    id: 'R_web',
    viewerPermission: 'WRITE',
    hasIssuesEnabled: true,
    isArchived: false,
    labels: [],
    milestones: [],
    assignableUsers: [],
    issueTypes: [],
    fetchedAt: 3000,
};

function detail(id: string, fetchedAt: number): ItemDetail {
    const read = toItemDetail(sampleIssueDetailNode(id, '2026-10-26T10:00:00Z'), fetchedAt);
    if (!read) {
        throw new Error('An issue always has a detail');
    }

    return read;
}

function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}

async function databaseNames() {
    const databases = await indexedDB.databases();
    return databases.map(database => database.name);
}

test('a project is kept with its items, and deleting it deletes its items — not another project’s', async () => {
    const login = uniqueLogin();
    const tab = createIndexedDbPersistence();
    await tab.load(login);
    await tab.saveProject(login, { project: sampleProject('PVT_1'), rowFieldId: null });
    await tab.saveProject(login, { project: sampleProject('PVT_2') });
    await tab.saveProjectItems(login, {
        upserted: [
            sampleProjectItem('PVTI_1', 'PVT_1'),
            sampleProjectItem('PVTI_2', 'PVT_1'),
            sampleProjectItem('PVTI_3', 'PVT_2'),
        ],
        removed: [],
    });

    await tab.deleteProject(login, 'PVT_1');

    const expected: PersistedProjects = {
        projects: [{ project: sampleProject('PVT_2') }],
        items: [sampleProjectItem('PVTI_3', 'PVT_2')],
    };
    expect(await tab.loadProjects(login)).toEqual(expected);
});

function sampleProject(id: string): Project {
    return {
        id,
        title: id,
        number: 1,
        url: `https://github.com/orgs/acme/projects/${id}`,
        owner: 'acme',
        ownerKind: 'org',
        closed: false,
        viewerCanUpdate: true,
        fields: [],
        views: [],
    };
}

function sampleProjectItem(itemId: string, projectId: string): ProjectItem {
    return {
        itemId,
        projectId,
        contentId: null,
        draft: null,
        values: {},
        updatedAt: '2026-10-30T10:00:00Z',
        isArchived: false,
    };
}
