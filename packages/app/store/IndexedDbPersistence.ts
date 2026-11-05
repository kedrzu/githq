import { deleteDB, openDB } from 'idb';
import type { DBSchema } from 'idb';

import type { CommitPersistenceShape, PersistedCommits } from '@/commits/CommitPersistence.js';
import type { KeptCommit, KeptCommitRefs } from '@/commits/CommitTypes.js';
import type {
    PersistedProject,
    PersistedProjects,
    ProjectItemChanges,
    ProjectPersistenceShape,
} from '@/projects/ProjectPersistence.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { PersistedRepositories, RepositoryPersistenceShape } from '@/repos/RepositoryPersistence.js';
import type { RepositoryMetadata, ViewerProjects } from '@/repos/RepositoryTypes.js';
import { getReviewBlobDatabaseName } from '@/review/ReviewBlobStore.js';
import type { TrackingPersistenceShape } from '@/tracking/TrackingPersistence.js';
import type { TrackedSyncState } from '@/tracking/TrackingTypes.js';
import { getTrackedKey } from '@/tracking/utils/getTrackedKey.js';
import { createDatabaseConnections } from '@/utils/createDatabaseConnections.js';
import type { WorkflowPersistenceShape } from '@/workflows/WorkflowPersistence.js';
import type { RepositoryWorkflows } from '@/workflows/WorkflowTypes.js';

import type { ItemDetailPersistenceShape, ItemDetailVersion } from './ItemDetailPersistence.js';
import type { ItemDetail } from './ItemDetailTypes.js';
import type { ItemChanges, ItemPersistenceShape, PersistedItems } from './ItemPersistence.js';
import type { LocalCopyVersionShape } from './LocalCopyVersion.js';
import type { MyWorkGroup, SyncLoop, SyncLoopState } from './ItemStoreTypes.js';
import type { Item } from './ItemTypes.js';

/**
 * The layout of the database and of what it holds. Raise it whenever either changes (the `Item`, `ItemDetail`,
 * `RepositoryMetadata`, `Project`, `ProjectItem`, tracking, `RepositoryWorkflows`, `KeptCommit` or `KeptCommitRefs` types too): a database of another version is dropped
 * and rebuilt, never migrated — it is a cache. It names the channel the tabs talk over (`TabChannel`) and the lock of
 * the tab that syncs (`SyncLeadership`) too: raise it when a `TabMessage` or what a tab says of itself changes, so tabs of two githq versions do not
 * hear each other, and a tab of one is not left waiting for a tab of another.
 */
export const LOCAL_DATABASE_VERSION = 15;

/** The database of `login`'s local copy. */
export function getLocalDatabaseName(login: string) {
    return `githq-${login}`;
}

/** The local copy in IndexedDB, behind each of the interfaces its parts are kept through. */
export type IndexedDbPersistence = ItemPersistenceShape &
    ItemDetailPersistenceShape &
    RepositoryPersistenceShape &
    TrackingPersistenceShape &
    ProjectPersistenceShape &
    WorkflowPersistenceShape &
    CommitPersistenceShape &
    LocalCopyVersionShape;

type MetaRecord =
    | { readonly key: 'membership'; readonly value: Partial<Record<MyWorkGroup, readonly string[]>> }
    | { readonly key: 'sync'; readonly value: Partial<Record<SyncLoop, SyncLoopState>> }
    | { readonly key: 'viewerProjects'; readonly value: ViewerProjects };

/** A tracked repository's or project's sync state, by `repository:<owner/name>` or `project:<id>`. */
interface SyncStateRecord {
    readonly key: string;
    readonly state: TrackedSyncState;
}

interface LocalDatabase extends DBSchema {
    items: { key: string; value: Item };
    meta: { key: MetaRecord['key']; value: MetaRecord };
    details: {
        key: string;
        value: ItemDetail;
        /** `[item.updatedAt, fetchedAt]`: every detail's version, read from the index without the details. */
        indexes: { version: [string, number] };
    };
    repositories: { key: string; value: RepositoryMetadata };
    projects: { key: string; value: PersistedProject };
    projectItems: { key: string; value: ProjectItem; indexes: { projectId: string } };
    trackedSync: { key: string; value: SyncStateRecord };
    workflows: { key: string; value: RepositoryWorkflows };
    commits: { key: [string, string]; value: KeptCommit; indexes: { repository: string } };
    commitRefs: { key: string; value: KeptCommitRefs };
}

/**
 * The local copy in IndexedDB: a database per login (`githq-<login>`) with the stores `items` (by id), `meta`
 * (memberships, sync state, the viewer's projects), `details` (by item id), `repositories`
 * (by `owner/name`), `projects` (by id), `projectItems` (by project item id), `trackedSync` (each tracked
 * repository's and project's sync state), `workflows` (each tracked repository's, by `owner/name`), `commits` (by
 * `[repository, oid]`, kept for good) and `commitRefs` (each repository's branches and tags, by `owner/name`). One object for the interfaces it is set as: they share the
 * connection.
 *
 * Only {@link ItemPersistenceShape.load} opens the database. A connection gives way when another one wants
 * the database deleted or upgraded — another tab signing out, or a newer githq — and is not opened again until
 * the next `load`: a write or read must never bring back a database deleted on sign-out.
 */
export function createIndexedDbPersistence(): IndexedDbPersistence {
    const newerVersionListeners: (() => void)[] = [];
    const { connect, getOpen, forget } = createDatabaseConnections(
        login => open(getLocalDatabaseName(login)),
        () => {
            for (const listener of newerVersionListeners) {
                listener();
            }
        },
    );

    return {
        onNewerVersion: listener => {
            newerVersionListeners.push(listener);
        },
        load,
        save,
        destroy,
        loadDetailVersions,
        loadDetail,
        saveDetails,
        deleteDetails,
        loadRepositories,
        saveRepository,
        saveViewerProjects,
        loadSyncStates,
        saveSyncState,
        deleteSyncState,
        loadProjects,
        saveProject,
        saveProjectItems,
        deleteProject,
        loadWorkflows,
        saveWorkflows,
        deleteWorkflows,
        loadCommits,
        saveCommits,
        saveCommitRefs,
    };

    async function load(login: string): Promise<PersistedItems> {
        const db = await connect(login);
        const tx = db.transaction(['items', 'meta']);
        const [items, meta] = await Promise.all([tx.objectStore('items').getAll(), tx.objectStore('meta').getAll()]);

        let membership: PersistedItems['membership'] = {};
        let sync: PersistedItems['sync'] = {};
        for (const record of meta) {
            switch (record.key) {
                case 'membership':
                    membership = record.value;
                    break;
                case 'sync':
                    sync = record.value;
                    break;
                default:
                    // Read on its own (`viewerProjects`), or left behind by an earlier build: not an error.
                    break;
            }
        }

        return { items, membership, sync };
    }

    async function save(login: string, changes: ItemChanges) {
        const db = await getOpen(login);
        const tx = db.transaction(['items', 'meta'], 'readwrite');
        const items = tx.objectStore('items');
        const meta = tx.objectStore('meta');
        const writes: Promise<unknown>[] = [];

        for (const item of changes.upserted) {
            writes.push(items.put(item));
        }

        for (const id of changes.removed) {
            writes.push(items.delete(id));
        }

        if (changes.membership) {
            writes.push(meta.put({ key: 'membership', value: changes.membership }));
        }

        if (changes.sync) {
            writes.push(meta.put({ key: 'sync', value: changes.sync }));
        }

        await Promise.all([...writes, tx.done]);
    }

    async function destroy(login: string) {
        // Not waiting for this tab's connection to close: the deletion is queued behind it by IndexedDB itself,
        // and a `load` called after this one is queued behind the deletion.
        forget(login);
        // The contents of the files they reviewed go with it: `ReviewBlobStore` keeps them apart only so that they
        // survive a raise of this database's version.
        await Promise.all([deleteDB(getLocalDatabaseName(login)), deleteDB(getReviewBlobDatabaseName(login))]);
    }

    async function loadDetailVersions(login: string) {
        const db = await getOpen(login);
        const versions = new Map<string, ItemDetailVersion>();
        let cursor = await db.transaction('details').store.index('version').openKeyCursor();
        while (cursor) {
            const [itemUpdatedAt, fetchedAt] = cursor.key;
            versions.set(cursor.primaryKey, { itemUpdatedAt, fetchedAt });
            cursor = await cursor.continue();
        }

        return versions;
    }

    async function loadDetail(login: string, id: string) {
        const db = await getOpen(login);
        return (await db.get('details', id)) ?? null;
    }

    async function saveDetails(login: string, details: readonly ItemDetail[]) {
        const db = await getOpen(login);
        const tx = db.transaction('details', 'readwrite');
        await Promise.all([...details.map(detail => tx.store.put(detail)), tx.done]);
    }

    async function deleteDetails(login: string, ids: readonly string[]) {
        const db = await getOpen(login);
        const tx = db.transaction('details', 'readwrite');
        await Promise.all([...ids.map(id => tx.store.delete(id)), tx.done]);
    }

    async function loadRepositories(login: string): Promise<PersistedRepositories> {
        const db = await getOpen(login);
        const tx = db.transaction(['repositories', 'meta']);
        const [repositories, viewerProjects] = await Promise.all([
            tx.objectStore('repositories').getAll(),
            tx.objectStore('meta').get('viewerProjects'),
        ]);

        return {
            repositories,
            viewerProjects: viewerProjects?.key === 'viewerProjects' ? viewerProjects.value : null,
        };
    }

    async function saveRepository(login: string, metadata: RepositoryMetadata) {
        const db = await getOpen(login);
        await db.put('repositories', metadata);
    }

    async function saveViewerProjects(login: string, projects: ViewerProjects) {
        const db = await getOpen(login);
        await db.put('meta', { key: 'viewerProjects', value: projects });
    }

    async function loadSyncStates(login: string) {
        const db = await getOpen(login);
        const records = await db.getAll('trackedSync');
        return records.map(record => record.state);
    }

    async function saveSyncState(login: string, state: TrackedSyncState) {
        const db = await getOpen(login);
        await db.put('trackedSync', { key: getTrackedKey(state), state });
    }

    async function deleteSyncState(login: string, state: TrackedSyncState) {
        const db = await getOpen(login);
        await db.delete('trackedSync', getTrackedKey(state));
    }

    async function loadProjects(login: string): Promise<PersistedProjects> {
        const db = await getOpen(login);
        const tx = db.transaction(['projects', 'projectItems']);
        const [projects, items] = await Promise.all([
            tx.objectStore('projects').getAll(),
            tx.objectStore('projectItems').getAll(),
        ]);

        return { projects, items };
    }

    async function saveProject(login: string, project: PersistedProject) {
        const db = await getOpen(login);
        await db.put('projects', project);
    }

    async function saveProjectItems(login: string, changes: ProjectItemChanges) {
        const db = await getOpen(login);
        const tx = db.transaction('projectItems', 'readwrite');
        await Promise.all([
            ...changes.upserted.map(item => tx.store.put(item)),
            ...changes.removed.map(id => tx.store.delete(id)),
            tx.done,
        ]);
    }

    async function deleteProject(login: string, projectId: string) {
        const db = await getOpen(login);
        const tx = db.transaction(['projects', 'projectItems'], 'readwrite');
        const items = tx.objectStore('projectItems');
        const ids = await items.index('projectId').getAllKeys(projectId);
        await Promise.all([tx.objectStore('projects').delete(projectId), ...ids.map(id => items.delete(id)), tx.done]);
    }

    async function loadWorkflows(login: string) {
        const db = await getOpen(login);
        return await db.getAll('workflows');
    }

    async function saveWorkflows(login: string, workflows: RepositoryWorkflows) {
        const db = await getOpen(login);
        await db.put('workflows', workflows);
    }

    async function deleteWorkflows(login: string, nameWithOwner: string) {
        const db = await getOpen(login);
        await db.delete('workflows', nameWithOwner);
    }

    async function loadCommits(login: string, repository: string): Promise<PersistedCommits> {
        const db = await getOpen(login);
        const tx = db.transaction(['commits', 'commitRefs']);
        const [commits, refs] = await Promise.all([
            tx.objectStore('commits').index('repository').getAll(repository),
            tx.objectStore('commitRefs').get(repository),
        ]);

        return { commits, refs: refs ?? null };
    }

    async function saveCommits(login: string, commits: readonly KeptCommit[]) {
        const db = await getOpen(login);
        const tx = db.transaction('commits', 'readwrite');
        await Promise.all([...commits.map(commit => tx.store.put(commit)), tx.done]);
    }

    async function saveCommitRefs(login: string, refs: KeptCommitRefs) {
        const db = await getOpen(login);
        await db.put('commitRefs', refs);
    }
}

async function open(name: string) {
    try {
        return await openDatabase(name);
    } catch (error) {
        // A database of a newer githq (this tab is older): it is a cache, so start it again.
        if (error instanceof Error && error.name === 'VersionError') {
            await deleteDB(name);
            return await openDatabase(name);
        }

        throw error;
    }
}

function openDatabase(name: string) {
    return openDB<LocalDatabase>(name, LOCAL_DATABASE_VERSION, {
        upgrade(db) {
            // A database of an older githq: drop what it held and build it again. Copied first: the list is live.
            for (const store of Array.from(db.objectStoreNames)) {
                db.deleteObjectStore(store);
            }

            db.createObjectStore('items', { keyPath: 'id' });
            db.createObjectStore('meta', { keyPath: 'key' });
            db.createObjectStore('details', { keyPath: 'id' }).createIndex('version', ['item.updatedAt', 'fetchedAt']);
            db.createObjectStore('repositories', { keyPath: 'nameWithOwner' });
            db.createObjectStore('projects', { keyPath: 'project.id' });
            db.createObjectStore('projectItems', { keyPath: 'itemId' }).createIndex('projectId', 'projectId');
            db.createObjectStore('trackedSync', { keyPath: 'key' });
            db.createObjectStore('workflows', { keyPath: 'nameWithOwner' });
            db.createObjectStore('commits', { keyPath: ['repository', 'oid'] }).createIndex('repository', 'repository');
            db.createObjectStore('commitRefs', { keyPath: 'repository' });
        },
    });
}
