import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { RepositoryMetadata, ViewerProjects } from './RepositoryTypes.js';

/** The repository metadata of one user, as kept on disk. */
export interface PersistedRepositories {
    readonly repositories: readonly RepositoryMetadata[];
    /** `null` until they were first read. */
    readonly viewerProjects: ViewerProjects | null;
}

/**
 * Where repository metadata is kept between sessions: in the copy of the login that `ItemPersistence.load`
 * opened (D17), deleted with it. Every method rejects when that copy is not open (anymore) — a late answer of
 * a signed-out user must not bring their copy back.
 */
export interface RepositoryPersistenceShape {
    loadRepositories(login: string): Promise<PersistedRepositories>;
    /** Adds the metadata or replaces it (by `nameWithOwner`). */
    saveRepository(login: string, metadata: RepositoryMetadata): Promise<void>;
    saveViewerProjects(login: string, projects: ViewerProjects): Promise<void>;
}

/** Where repository metadata is kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const RepositoryPersistence = defineInterface<RepositoryPersistenceShape>({
    name: 'RepositoryPersistence',
});
