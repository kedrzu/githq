import type { Container } from '@nzyme/ioc/Container.js';

import { ProjectPersistence } from '@/projects/ProjectPersistence.js';
import { RepositoryPersistence } from '@/repos/RepositoryPersistence.js';
import { createIndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import type { IndexedDbPersistence } from '@/store/IndexedDbPersistence.js';
import { ItemDetailPersistence } from '@/store/ItemDetailPersistence.js';
import { ItemPersistence } from '@/store/ItemPersistence.js';
import { TrackingPersistence } from '@/tracking/TrackingPersistence.js';

/**
 * Sets the local copy of a test's container to IndexedDB, behind every interface its parts are kept through —
 * as the app does. Under `bun test` the test file imports `fake-indexeddb/auto` first; a later container given
 * the same `persistence` (or a new one) reads what this one wrote, as a reloaded tab would.
 */
export function setIndexedDbPersistence(
    container: Container,
    persistence: IndexedDbPersistence = createIndexedDbPersistence(),
) {
    container.set(ItemPersistence, persistence);
    container.set(ItemDetailPersistence, persistence);
    container.set(RepositoryPersistence, persistence);
    container.set(TrackingPersistence, persistence);
    container.set(ProjectPersistence, persistence);
    return persistence;
}
