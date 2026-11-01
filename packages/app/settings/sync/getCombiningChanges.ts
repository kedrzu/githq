import type { TrackedTarget } from '@/tracking/TrackingTypes.js';
import { getTrackedKey } from '@/tracking/utils/getTrackedKey.js';

import { mergeSettings } from './mergeSettings.js';
import { EMPTY_SETTINGS_DOCUMENT } from './SettingsDocument.js';
import type { SettingsDocument } from './SettingsDocument.js';

/** A repository or project {@link getCombiningChanges} names: what it is, and how the user knows it. */
export interface CombiningEntry {
    readonly target: TrackedTarget;
    /** `owner/name`, or a project's title. */
    readonly name: string;
}

/** What turning syncing on with a file found would change (settings-sync T6, D9). */
export interface CombiningChanges {
    /** Tracked in the file and not here: tracked here, and downloaded. */
    readonly download: readonly CombiningEntry[];
    /** Tracked here and not in the file: added to it. */
    readonly saved: readonly CombiningEntry[];
    /** Tracked here and marked untracked in the file: untracked here, its copy deleted. */
    readonly untracked: readonly CombiningEntry[];
}

/**
 * What combining this device's settings with the file found when turning syncing on changes, on either side — the
 * merge of first contact (D9), compared with both.
 * @__NO_SIDE_EFFECTS__
 */
export function getCombiningChanges(local: SettingsDocument, remote: SettingsDocument): CombiningChanges {
    const merged = mergeSettings({ local, remote, base: EMPTY_SETTINGS_DOCUMENT });
    const trackedHere = getTracked(local);
    const trackedThere = getTracked(remote);
    const download: CombiningEntry[] = [];
    const saved: CombiningEntry[] = [];
    const untracked: CombiningEntry[] = [];

    for (const { target, name, tracking } of getEntries(merged)) {
        const key = getTrackedKey(target);
        const here = trackedHere.has(key);
        if (tracking && !here) {
            download.push({ target, name });
        } else if (tracking && !trackedThere.has(key)) {
            saved.push({ target, name });
        } else if (!tracking && here) {
            untracked.push({ target, name });
        }
    }

    return { download, saved, untracked };
}

function getTracked(document: SettingsDocument) {
    return new Set(
        getEntries(document)
            .filter(entry => entry.tracking)
            .map(entry => getTrackedKey(entry.target)),
    );
}

function getEntries(document: SettingsDocument) {
    return [
        ...document.repositories.map(repository => ({
            target: { kind: 'repository', nameWithOwner: repository.nameWithOwner } satisfies TrackedTarget,
            name: repository.nameWithOwner,
            tracking: repository.tracking,
        })),
        ...document.projects.map(project => ({
            target: { kind: 'project', id: project.id } satisfies TrackedTarget,
            name: project.title,
            tracking: project.tracking,
        })),
    ];
}
