import { deepEquals } from '@nzyme/utils/deepEquals.js';

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
 * file's, then the entries only this device has, in its order; except when only this device reordered the entries it
 * shares with `base`, which keeps this device's order, followed by the entries only the file has.
 * @__NO_SIDE_EFFECTS__
 */
export function mergeSettings({ local, remote, base }: MergeSettingsParams): SettingsDocument {
    return {
        ...mergeFields(local, remote, base),
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
        ...mergeFields(local, remote, base),
        nameWithOwner: remote.nameWithOwner,
        id: pick(local.id, remote.id, base.id),
        tracking: pick(local.tracking, remote.tracking, base.tracking),
    }),
};

const PROJECTS: EntryKind<SettingsProject> = {
    keyOf: project => project.id,
    merge: (local, remote, base) => ({
        ...mergeFields(local, remote, base),
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

function mergeEntries<T>({ local, remote, base }: EntryVersions<T>, kind: EntryKind<T>): T[] {
    const { keyOf } = kind;
    const baseKeys = base.map(keyOf);
    const localReordered = isReordered(local.map(keyOf), baseKeys);
    const remoteReordered = isReordered(remote.map(keyOf), baseKeys);

    return localReordered && !remoteReordered
        ? mergeInLocalOrder({ local, remote, base }, kind)
        : mergeInFileOrder({ local, remote, base }, kind);
}

/** The file's order, then the entries only this device has, in its order. */
function mergeInFileOrder<T>({ local, remote, base }: EntryVersions<T>, { keyOf, merge }: EntryKind<T>): T[] {
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

/** This device's order, then the entries only the file has, in its order. */
function mergeInLocalOrder<T>({ local, remote, base }: EntryVersions<T>, { keyOf, merge }: EntryKind<T>): T[] {
    const remoteByKey = new Map(remote.map(entry => [keyOf(entry), entry]));
    const baseByKey = new Map(base.map(entry => [keyOf(entry), entry]));
    const localKeys = new Set(local.map(keyOf));

    const merged = local.map(localEntry => {
        const key = keyOf(localEntry);
        const remoteEntry = remoteByKey.get(key);
        const baseEntry = baseByKey.get(key);
        if (!remoteEntry) {
            return localEntry;
        }

        return baseEntry ? merge(localEntry, remoteEntry, baseEntry) : remoteEntry;
    });

    for (const entry of remote) {
        if (!localKeys.has(keyOf(entry))) {
            merged.push(entry);
        }
    }

    return merged;
}

/** Whether the keys `keys` shares with `baseKeys` are in another relative order than in `baseKeys`. */
function isReordered(keys: readonly string[], baseKeys: readonly string[]): boolean {
    const baseSet = new Set(baseKeys);
    const keySet = new Set(keys);
    const shared = keys.filter(key => baseSet.has(key));
    const sharedInBase = baseKeys.filter(key => keySet.has(key));

    return shared.some((key, index) => key !== sharedInBase[index]);
}

/**
 * Every field of the three, merged with {@link pick}, so one this build does not know survives a merge the same way
 * (D13). The fields it knows are merged again by name, which gives them their types. A field the merge leaves
 * `undefined` was removed, and is left out.
 */
function mergeFields(
    local: Readonly<Record<string, unknown>>,
    remote: Readonly<Record<string, unknown>>,
    base: Readonly<Record<string, unknown>>,
) {
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
        const value = pick(local[key], remote[key], base[key]);
        if (value !== undefined) {
            merged[key] = value;
        }
    }

    return merged;
}

/** The local value when only this device changed the key; the file's otherwise. */
function pick<T>(local: T, remote: T, base: T): T {
    return deepEquals(remote, base) ? local : remote;
}
