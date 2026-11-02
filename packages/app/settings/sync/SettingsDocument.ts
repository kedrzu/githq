import * as z from 'zod/mini';

import type { TrackedProject, TrackedRepository } from '@/tracking/TrackingTypes.js';

/**
 * The user's settings in the shape of the settings repository's `settings.json` (D13): every repository and project
 * the user ever tracked, in their order, each saying whether it is tracked now. Entries are never removed —
 * untracking sets `tracking: false`, so an entry tracked again returns to its old place.
 *
 * The document and its entries keep the fields this build does not know, so a build older than the one that added a
 * field writes it back untouched (D13).
 */
export interface SettingsDocument {
    /** Raised only for a change an older build cannot carry; a new field is optional and keeps `version` (D13). */
    readonly version: 1;
    readonly repositories: readonly SettingsRepository[];
    readonly projects: readonly SettingsProject[];
    readonly [field: string]: unknown;
}

/** A repository of {@link SettingsDocument}, named by `nameWithOwner`. */
export interface SettingsRepository extends TrackedRepository {
    readonly tracking: boolean;
    readonly [field: string]: unknown;
}

/** A project of {@link SettingsDocument}, named by `id`. */
export interface SettingsProject extends TrackedProject {
    readonly tracking: boolean;
    readonly [field: string]: unknown;
}

/** A document of no repository and no project. */
export const EMPTY_SETTINGS_DOCUMENT: SettingsDocument = { version: 1, repositories: [], projects: [] };

/** What {@link parseSettings} made of a settings file. */
export type ParsedSettings =
    | { readonly kind: 'ok'; readonly document: SettingsDocument }
    /** Not JSON, or not a document: an entry not understood, or two naming the same repository or project. */
    | { readonly kind: 'unreadable' }
    /** Written by a newer githq, which raised `version` for a change this build cannot carry (D13). */
    | { readonly kind: 'newer'; readonly version: number };

const VersionSchema = z.looseObject({ version: z.int() });

const RepositorySchema = z.looseObject({
    nameWithOwner: z.string(),
    id: z.string(),
    tracking: z.boolean(),
});

const ProjectSchema = z.looseObject({
    id: z.string(),
    owner: z.string(),
    ownerKind: z.enum(['user', 'org']),
    number: z.number(),
    title: z.string(),
    tracking: z.boolean(),
});

const DocumentSchema = z.looseObject({
    version: z.literal(1),
    repositories: z.array(RepositorySchema),
    projects: z.array(ProjectSchema),
});

/** A document of version 1 whose entries are read one by one. */
const LenientDocumentSchema = z.looseObject({
    version: z.literal(1),
    repositories: z.optional(z.array(z.unknown())),
    projects: z.optional(z.array(z.unknown())),
});

/**
 * Reads the text of `settings.json`. Strict, unlike {@link readSettingsDocument}: anything not understood makes the
 * whole file unreadable, so a sync stops rather than overwrite what it could not read (D12). A field it does not
 * know is not "not understood": it is kept.
 * @__NO_SIDE_EFFECTS__
 */
export function parseSettings(text: string): ParsedSettings {
    let stored: unknown;
    try {
        stored = JSON.parse(text);
    } catch {
        return { kind: 'unreadable' };
    }

    const versioned = VersionSchema.safeParse(stored);
    if (!versioned.success) {
        return { kind: 'unreadable' };
    }

    if (versioned.data.version > 1) {
        return { kind: 'newer', version: versioned.data.version };
    }

    const parsed = DocumentSchema.safeParse(stored);
    if (
        !parsed.success ||
        hasDuplicates(parsed.data.repositories.map(repository => repository.nameWithOwner)) ||
        hasDuplicates(parsed.data.projects.map(project => project.id))
    ) {
        return { kind: 'unreadable' };
    }

    return { kind: 'ok', document: parsed.data };
}

/**
 * The text of `settings.json` for `document` (D13): formatted, the known keys in a stable order and the unknown ones
 * after them as they came, a trailing newline — so each change reads as a small diff on github.com.
 * @__NO_SIDE_EFFECTS__
 */
export function serializeSettings(document: SettingsDocument): string {
    const { version, repositories, projects, ...rest } = document;
    const ordered: SettingsDocument = {
        version,
        repositories: repositories.map(({ nameWithOwner, id, tracking, ...unknown }) => ({
            nameWithOwner,
            id,
            tracking,
            ...unknown,
        })),
        projects: projects.map(({ id, owner, ownerKind, number, title, tracking, ...unknown }) => ({
            id,
            owner,
            ownerKind,
            number,
            title,
            tracking,
            ...unknown,
        })),
        ...rest,
    };
    return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * The document in `stored`, `null` when it is not one of version 1. An entry not understood is left out, as is a
 * second entry naming the same repository or project.
 */
export function readSettingsDocument(stored: unknown): SettingsDocument | null {
    const parsed = LenientDocumentSchema.safeParse(stored);
    if (!parsed.success) {
        return null;
    }

    const repositories: SettingsRepository[] = [];
    for (const entry of parsed.data.repositories ?? []) {
        const repository = RepositorySchema.safeParse(entry);
        if (repository.success && !repositories.some(other => other.nameWithOwner === repository.data.nameWithOwner)) {
            repositories.push(repository.data);
        }
    }

    const projects: SettingsProject[] = [];
    for (const entry of parsed.data.projects ?? []) {
        const project = ProjectSchema.safeParse(entry);
        if (project.success && !projects.some(other => other.id === project.data.id)) {
            projects.push(project.data);
        }
    }

    return { ...parsed.data, repositories, projects };
}

function hasDuplicates(keys: readonly string[]) {
    return new Set(keys).size !== keys.length;
}
