import { defineInterface } from '@nzyme/ioc/Interface.js';

import type { Project, ProjectItem } from './ProjectTypes.js';

/** A tracked project as kept on disk, with the user's choice of its row field. */
export interface PersistedProject {
    readonly project: Project;
    /** The row field the user picked (D12) — `null` for none; missing for the default. */
    readonly rowFieldId?: string | null;
}

/** The tracked projects of one user, as kept on disk. */
export interface PersistedProjects {
    readonly projects: readonly PersistedProject[];
    readonly items: readonly ProjectItem[];
}

/** What changed of the project items in memory since the last write. */
export interface ProjectItemChanges {
    readonly upserted: readonly ProjectItem[];
    /** Project item ids. */
    readonly removed: readonly string[];
}

/**
 * Where tracked projects are kept between sessions: in the copy of the login that `ItemPersistence.load`
 * opened (D17), deleted with it. Every method rejects when that copy is not open (anymore).
 */
export interface ProjectPersistenceShape {
    loadProjects(login: string): Promise<PersistedProjects>;
    /** Adds the project or replaces it (by id). */
    saveProject(login: string, project: PersistedProject): Promise<void>;
    saveProjectItems(login: string, changes: ProjectItemChanges): Promise<void>;
    /** Deletes the project and every item of it. */
    deleteProject(login: string, projectId: string): Promise<void>;
}

/** Where tracked projects are kept; the app sets IndexedDB (`createIndexedDbPersistence`). */
export const ProjectPersistence = defineInterface<ProjectPersistenceShape>({
    name: 'ProjectPersistence',
});
