import type { SettingsDocument, SettingsProject, SettingsRepository } from './SettingsDocument.js';

/** The three versions {@link mergeSettings} compares. */
export interface MergeSettingsParams {
    /** This device's settings. */
    readonly local: SettingsDocument;
    /** The file as it is now. */
    readonly remote: SettingsDocument;
    /** The file as this device last saw it; an empty document on first contact (D9). */
    readonly base: SettingsDocument;
}

/**
 * The three-way merge of settings-sync D11. Entries are matched by identity (a repository's `nameWithOwner`, a
 * project's `id`) and merged key by key: a key only one side changed since `base` takes that side's value, one both
 * changed takes the file's. An entry `base` lacks counts as changed on every side holding it, so one both hold is
 * the file's. Nothing is removed — one hand-deleted from the file stays as this device has it. The order is the
 * file's, then the entries only this device has, in its order.
 * @__NO_SIDE_EFFECTS__
 */
export function mergeSettings({ local, remote, base }: MergeSettingsParams): SettingsDocument {
    return {
        version: 1,
        repositories: mergeEntries(
            { local: local.repositories, remote: remote.repositories, base: base.repositories },
            REPOSITORIES,
        ),
        projects: mergeEntries({ local: local.projects, remote: remote.projects, base: base.projects }, PROJECTS),
    };
}

/** How the entries of one list are named and merged. */
interface EntryKind<T> {
    readonly keyOf: (entry: T) => string;
    readonly merge: (local: T, remote: T, base: T) => T;
}

const REPOSITORIES: EntryKind<SettingsRepository> = {
    keyOf: repository => repository.nameWithOwner,
    merge: (local, remote, base) => ({
        nameWithOwner: remote.nameWithOwner,
        id: pick(local.id, remote.id, base.id),
        tracking: pick(local.tracking, remote.tracking, base.tracking),
    }),
};

const PROJECTS: EntryKind<SettingsProject> = {
    keyOf: project => project.id,
    merge: (local, remote, base) => ({
        id: remote.id,
        owner: pick(local.owner, remote.owner, base.owner),
        ownerKind: pick(local.ownerKind, remote.ownerKind, base.ownerKind),
        number: pick(local.number, remote.number, base.number),
        title: pick(local.title, remote.title, base.title),
        tracking: pick(local.tracking, remote.tracking, base.tracking),
    }),
};

/** One list of each version. */
interface EntryVersions<T> {
    readonly local: readonly T[];
    readonly remote: readonly T[];
    readonly base: readonly T[];
}

function mergeEntries<T>({ local, remote, base }: EntryVersions<T>, { keyOf, merge }: EntryKind<T>): T[] {
    const localByKey = new Map(local.map(entry => [keyOf(entry), entry]));
    const baseByKey = new Map(base.map(entry => [keyOf(entry), entry]));
    const remoteKeys = new Set(remote.map(keyOf));

    const merged = remote.map(remoteEntry => {
        const key = keyOf(remoteEntry);
        const localEntry = localByKey.get(key);
        const baseEntry = baseByKey.get(key);
        return localEntry && baseEntry ? merge(localEntry, remoteEntry, baseEntry) : remoteEntry;
    });

    for (const entry of local) {
        if (!remoteKeys.has(keyOf(entry))) {
            merged.push(entry);
        }
    }

    return merged;
}

/** The local value when only this device changed the key; the file's otherwise. */
function pick<T>(local: T, remote: T, base: T): T {
    return remote === base ? local : remote;
}
