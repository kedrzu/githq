import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { TrackedProject, TrackedRepository } from '@/tracking/TrackingTypes.js';

/**
 * The user's settings in the shape of the settings repository's `settings.json` (D13): every repository and project
 * the user ever tracked, in their order, each saying whether it is tracked now. Entries are never removed —
 * untracking sets `tracking: false`, so an entry tracked again returns to its old place.
 */
export interface SettingsDocument {
    /** Raised with any new field (D13). */
    readonly version: 1;
    readonly repositories: readonly SettingsRepository[];
    readonly projects: readonly SettingsProject[];
}

/** A repository of {@link SettingsDocument}, named by `nameWithOwner`. */
export interface SettingsRepository extends TrackedRepository {
    readonly tracking: boolean;
}

/** A project of {@link SettingsDocument}, named by `id`. */
export interface SettingsProject extends TrackedProject {
    readonly tracking: boolean;
}

/** A document of no repository and no project. */
export const EMPTY_SETTINGS_DOCUMENT: SettingsDocument = { version: 1, repositories: [], projects: [] };

/**
 * The document in `stored`, `null` when it is not one of version 1. An entry not understood is left out, as is a
 * second entry naming the same repository or project.
 */
export function readSettingsDocument(stored: unknown): SettingsDocument | null {
    if (!isPlainObject(stored) || stored.version !== 1) {
        return null;
    }

    const repositories: SettingsRepository[] = [];
    for (const entry of Array.isArray(stored.repositories) ? stored.repositories : []) {
        const repository = readRepository(entry);
        if (repository && !repositories.some(other => other.nameWithOwner === repository.nameWithOwner)) {
            repositories.push(repository);
        }
    }

    const projects: SettingsProject[] = [];
    for (const entry of Array.isArray(stored.projects) ? stored.projects : []) {
        const project = readProject(entry);
        if (project && !projects.some(other => other.id === project.id)) {
            projects.push(project);
        }
    }

    return { version: 1, repositories, projects };
}

function readRepository(entry: unknown): SettingsRepository | null {
    if (!isPlainObject(entry)) {
        return null;
    }

    const { nameWithOwner, id, tracking } = entry;
    if (typeof nameWithOwner !== 'string' || typeof id !== 'string' || typeof tracking !== 'boolean') {
        return null;
    }

    return { nameWithOwner, id, tracking };
}

function readProject(entry: unknown): SettingsProject | null {
    if (!isPlainObject(entry)) {
        return null;
    }

    const { id, owner, ownerKind, number, title, tracking } = entry;
    if (
        typeof id !== 'string' ||
        typeof owner !== 'string' ||
        (ownerKind !== 'user' && ownerKind !== 'org') ||
        typeof number !== 'number' ||
        typeof title !== 'string' ||
        typeof tracking !== 'boolean'
    ) {
        return null;
    }

    return { id, owner, ownerKind, number, title, tracking };
}
