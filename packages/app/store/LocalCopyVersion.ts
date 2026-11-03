import { defineInterface } from '@nzyme/ioc/Interface.js';

/** What this tab hears of the version of the local copy. */
export interface LocalCopyVersionShape {
    /**
     * Calls `listener` when another tab opens the copy in a newer layout than this tab's: a newer githq is out, and
     * this tab can neither keep anything in the copy nor talk to that tab any more.
     */
    onNewerVersion(listener: () => void): void;
}

/** The local copy's version; the app sets IndexedDB (`createIndexedDbPersistence`), and without it nothing is heard. */
export const LocalCopyVersion = defineInterface<LocalCopyVersionShape>({
    name: 'LocalCopyVersion',
    default: () => ({ onNewerVersion: () => {} }),
});
