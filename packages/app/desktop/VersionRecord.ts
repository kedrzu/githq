import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { VersionChange } from '@/services/AppUpdate.js';

/** Where the desktop app keeps its {@link VersionRecord}: on this device, in the desktop app only. */
export const VERSION_RECORD_KEY = 'githq.desktop.versions';

/**
 * What the desktop app remembers of the versions it ran, written at every launch from the very first public version on,
 * so that its successor can say it updated (desktop releases D7).
 */
export interface VersionRecord {
    /** The version running at the last launch. */
    readonly version: string;
    /** The version before it, kept until the next update: what "New" counts from (D17); `null` until one exists. */
    readonly previousVersion: string | null;
    /** The update hasn't been told yet: it waits for the toast, which needs someone signed in. */
    readonly untold: boolean;
}

/**
 * What is kept after a launch of `running`: the first ever run has nothing to tell, the same version changes nothing,
 * and another one, newer or older, is an update to tell.
 * @__NO_SIDE_EFFECTS__
 */
export function advanceVersionRecord(kept: VersionRecord | null, running: string): VersionRecord {
    if (kept === null) {
        return { version: running, previousVersion: null, untold: false };
    }

    if (kept.version === running) {
        return kept;
    }

    return { version: running, previousVersion: kept.version, untold: true };
}

/**
 * The update a record still has to tell, if any.
 * @__NO_SIDE_EFFECTS__
 */
export function getUntoldChange({ version, previousVersion, untold }: VersionRecord): VersionChange | null {
    return untold && previousVersion !== null ? { version, previousVersion } : null;
}

/**
 * Reads a kept record; anything else, nothing kept among it, reads as the first ever run.
 * @__NO_SIDE_EFFECTS__
 */
export function parseVersionRecord(raw: string | null): VersionRecord | null {
    if (raw === null) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (
            isPlainObject(parsed) &&
            typeof parsed.version === 'string' &&
            (parsed.previousVersion === null || typeof parsed.previousVersion === 'string') &&
            typeof parsed.untold === 'boolean'
        ) {
            return { version: parsed.version, previousVersion: parsed.previousVersion, untold: parsed.untold };
        }
    } catch {
        // Not ours: as if nothing were kept.
    }

    return null;
}
