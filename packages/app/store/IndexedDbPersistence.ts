import { deleteDB, openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

import { assertNever } from '@nzyme/utils/assertNever.js';

import type {
    PersistedProject,
    PersistedProjects,
    ProjectItemChanges,
    ProjectPersistenceShape,
} from '@/projects/ProjectPersistence.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import type { PersistedRepositories, RepositoryPersistenceShape } from '@/repos/RepositoryPersistence.js';
import type { RepositoryMetadata, ViewerProjects } from '@/repos/RepositoryTypes.js';
import type { PersistedTracking, TrackingPersistenceShape } from '@/tracking/TrackingPersistence.js';
import type { TrackedSyncState, Tracking } from '@/tracking/TrackingTypes.js';

import type { ItemDetailPersistenceShape, ItemDetailVersion } from './ItemDetailPersistence.js';
import type { ItemDetail } from './ItemDetailTypes.js';
import type { ItemChanges, ItemPersistenceShape, PersistedItems } from './ItemPersistence.js';
import type { MyWorkGroup, SyncLoop, SyncLoopState } from './ItemStoreTypes.js';
import type { Item } from './ItemTypes.js';

/**
 * The layout of the database and of what it holds. Raise it whenever either changes (the `Item`, `ItemDetail`,
 * `RepositoryMetadata`, `Project`, `ProjectItem` or tracking types too): a database of another version is dropped
 * and rebuilt, never migrated — it is a cache. It names the channel the tabs talk over too (`TabChannel`): raise
 * it when a `TabMessage` changes, so tabs of two githq versions do not hear each other.
 */
export const LOCAL_DATABASE_VERSION = 3;

/** The database of `login`'s local copy. */
export function getLocalDatabaseName(login: string) {
    return `githq-${login}`;
}

/** The local copy in IndexedDB, behind each of the interfaces its parts are kept through. */
export type IndexedDbPersistence = ItemPersistenceShape &
    ItemDetailPersistenceShape &
    RepositoryPersistenceShape &
    TrackingPersistenceShape &
    ProjectPersistenceShape;

type MetaRecord =
    | { readonly key: 'membership'; readonly value: Partial<Record<MyWorkGroup, readonly string[]>> }
    | { readonly key: 'sync'; readonly value: Partial<Record<SyncLoop, SyncLoopState>> }
    | { readonly key: 'viewerProjects'; readonly value: ViewerProjects }
    | { readonly key: 'tracking'; readonly value: Tracking };

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
}

/**
 * The local copy in IndexedDB: a database per login (`githq-<login>`) with the stores `items` (by id), `meta`
 * (memberships, sync state, the viewer's projects, the tracking choice), `details` (by item id), `repositories`
 * (by `owner/name`), `projects` (by id), `projectItems` (by project item id) and `trackedSync` (each tracked
 * repository's and project's sync state). One object for the interfaces it is set as: they share the
 * connection.
 *
 * Only {@link ItemPersistenceShape.load} opens the database. A connection gives way when another one wants
 * the database deleted or upgraded — another tab signing out, or a newer githq — and is not opened again until
 * the next `load`: a write or read must never bring back a database deleted on sign-out.
 */
export function createIndexedDbPersistence(): IndexedDbPersistence {
    const connections = new Map<string, Promise<IDBPDatabase<LocalDatabase>>>();

    return {
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
        loadTracking,
        saveTracking,
        saveSyncState,
        deleteSyncState,
        loadProjects,
        saveProject,
        saveProjectItems,
        deleteProject,
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
                case 'viewerProjects':
                case 'tracking':
                    break;
                default:
                    assertNever(record);
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
        connections.delete(login);
        await deleteDB(getLocalDatabaseName(login));
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

    async function loadTracking(login: string): Promise<PersistedTracking> {
        const db = await getOpen(login);
        const tx = db.transaction(['meta', 'trackedSync']);
        const [tracking, syncStates] = await Promise.all([
            tx.objectStore('meta').get('tracking'),
            tx.objectStore('trackedSync').getAll(),
        ]);

        return {
            tracking: tracking?.key === 'tracking' ? tracking.value : null,
            syncStates: syncStates.map(record => record.state),
        };
    }

    async function saveTracking(login: string, tracking: Tracking) {
        const db = await getOpen(login);
        await db.put('meta', { key: 'tracking', value: tracking });
    }

    async function saveSyncState(login: string, state: TrackedSyncState) {
        const db = await getOpen(login);
        await db.put('trackedSync', { key: getSyncStateKey(state), state });
    }

    async function deleteSyncState(login: string, state: TrackedSyncState) {
        const db = await getOpen(login);
        await db.delete('trackedSync', getSyncStateKey(state));
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

    /** The connection `load` opened; rejects when there is none (anymore). */
    async function getOpen(login: string) {
        const connection = connections.get(login);
        if (!connection) {
            throw new Error(`The local copy of ${login} is not open`);
        }

        return await connection;
    }

    function connect(login: string) {
        let connection = connections.get(login);
        if (!connection) {
            connection = open(getLocalDatabaseName(login)).then(db => {
                db.addEventListener('versionchange', () => {
                    db.close();
                    if (connections.get(login) === connection) {
                        connections.delete(login);
                    }
                });
                return db;
            });

            connections.set(login, connection);
            connection.catch(() => {
                if (connections.get(login) === connection) {
                    connections.delete(login);
                }
            });
        }

        return connection;
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
        },
    });
}

function getSyncStateKey(state: TrackedSyncState) {
    return state.kind === 'repository' ? `repository:${state.nameWithOwner}` : `project:${state.id}`;
}
