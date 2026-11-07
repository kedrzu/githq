import type { Logger } from '@nzyme/logging/Logger.js';
import { computed, shallowRef } from 'vue';

import type { AppUpdateShape, UpdateNotice, UpdateOffer, UpdateState } from '@/services/AppUpdate.js';
import type { BrowserStorage } from '@/services/Browser.js';

import type { NativeBridgeShape } from './NativeBridge.js';
import { advanceVersionRecord, getUntoldChange, parseVersionRecord, VERSION_RECORD_KEY } from './VersionRecord.js';
import type { VersionRecord } from './VersionRecord.js';

/** How long an outcome with nothing left to do stays (U22). */
const OUTCOME_MS = 5000;

/** The parameters of {@link createDesktopAppUpdate}. */
export interface CreateDesktopAppUpdateParams {
    readonly bridge: NativeBridgeShape;
    readonly logger: Logger;
    /** Where the running version and the one before it are kept, on this device. */
    readonly storage: BrowserStorage;
    /** How long "up to date" and "no release" stay. */
    readonly outcomeMs?: number;
}

/**
 * The desktop app's updates: the native side checks, downloads and installs them (`src-tauri/src/updater.rs`) and
 * sends its whole state on every change; restarting into one is the user's call alone. It listens first and then asks
 * once, so nothing that happened before the app started listening is missed. What the status bar says and what the
 * update toast offers are derived here: an update to restart into is the toast's until dismissed, then the bar's.
 * The first state it gets also records the running version, at every launch, signed in or not (`VersionRecord.ts`, D7).
 */
export function createDesktopAppUpdate({
    bridge,
    logger,
    storage,
    outcomeMs = OUTCOME_MS,
}: CreateDesktopAppUpdateParams): AppUpdateShape {
    const state = shallowRef<UpdateState | null>(null);
    /**
     * How the last check the user asked for ended, held apart from the state: a timed check replaces the state, and a
     * failure stays until the user closes it.
     */
    const outcome = shallowRef<UpdateNotice | null>(null);
    /** The offer's toast was dismissed ("Later"): until the app next starts, or the user checks again. */
    const putOff = shallowRef(false);
    const notice = computed(getNotice);
    const offer = computed(getOffer);
    const versionRecord = shallowRef<VersionRecord | null>(null);
    /** The last outcome was closed or ran out; the state may still repeat it, until the user checks again. */
    let closed = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    void watchUpdates();

    return {
        get state() {
            return state.value;
        },
        get notice() {
            return notice.value;
        },
        get offer() {
            return offer.value;
        },
        get previousVersion() {
            return versionRecord.value?.previousVersion ?? null;
        },
        get untoldChange() {
            return versionRecord.value && getUntoldChange(versionRecord.value);
        },
        markUpdateTold: () => {
            if (versionRecord.value) {
                keepVersionRecord({ ...versionRecord.value, untold: false });
            }
        },
        check: () => {
            bridge.checkForUpdate().catch((error: unknown) => {
                logger.warn('Could not ask for an update check', { error });
            });
        },
        setStream: stream => {
            bridge.setUpdateStream(stream).catch((error: unknown) => {
                logger.warn('Could not switch the update stream', { error });
            });
        },
        restart: () => {
            bridge.restartToUpdate().catch((error: unknown) => {
                logger.warn('Could not restart into the update', { error });
            });
        },
        later: () => {
            putOff.value = true;
        },
        dismiss: closeOutcome,
    };

    async function watchUpdates() {
        try {
            await bridge.onUpdateState(applyState);
            const current = await bridge.updateStatus();
            // An event that got here first is newer than this answer.
            if (state.value === null) {
                applyState(current);
            }
        } catch (error) {
            logger.warn('Could not listen for app updates', { error });
        }
    }

    function applyState(next: UpdateState) {
        state.value = next;
        // The version running doesn't change while it runs.
        if (versionRecord.value === null) {
            keepVersionRecord(
                advanceVersionRecord(parseVersionRecord(storage.getItem(VERSION_RECORD_KEY)), next.version),
            );
        }

        const { activity, manual } = next;
        switch (activity.kind) {
            case 'idle':
            case 'downloading':
                return;
            case 'checking':
                if (manual) {
                    // The user asks again: whatever they closed or put off may speak again.
                    clearTimeout(expiry);
                    closed = false;
                    outcome.value = null;
                    putOff.value = false;
                }

                return;
            case 'ready':
            case 'installing':
            case 'installFailed':
                // Something to decide is on offer: an older outcome has no more to say, then or after "Later".
                clearTimeout(expiry);
                outcome.value = null;
                // Only Restart installs: how it ends is news to the user, though they had put the toast off.
                if (activity.kind === 'installing') {
                    putOff.value = false;
                }

                return;
            case 'upToDate':
                holdOutcome(next, { kind: 'upToDate', version: next.version }, true);
                return;
            case 'noRelease':
                holdOutcome(next, { kind: 'noRelease', stream: next.stream }, true);
                return;
            case 'failed':
                holdOutcome(next, activity, false);
        }
    }

    function keepVersionRecord(record: VersionRecord) {
        versionRecord.value = record;
        try {
            storage.setItem(VERSION_RECORD_KEY, JSON.stringify(record));
        } catch (error) {
            logger.warn('Could not keep the running version', { error });
        }
    }

    function holdOutcome(from: UpdateState, ended: UpdateNotice, expires: boolean) {
        // The state is sent again on any change, so an outcome already held or closed is not a new one.
        if (!from.manual || closed || outcome.value !== null) {
            return;
        }

        outcome.value = ended;
        if (expires) {
            expiry = setTimeout(closeOutcome, outcomeMs);
        }
    }

    function closeOutcome() {
        clearTimeout(expiry);
        closed = true;
        outcome.value = null;
    }

    function getNotice(): UpdateNotice | null {
        const current = state.value;
        if (current === null) {
            return null;
        }

        const { activity, manual } = current;
        switch (activity.kind) {
            case 'installing':
                return activity;
            case 'ready':
            case 'installFailed':
                // The toast says it until dismissed.
                return putOff.value ? activity : null;
            case 'checking':
            case 'downloading':
                return manual ? activity : outcome.value;
            default:
                return outcome.value;
        }
    }

    function getOffer(): UpdateOffer | null {
        const activity = state.value?.activity;
        if (putOff.value || (activity?.kind !== 'ready' && activity?.kind !== 'installFailed')) {
            return null;
        }

        return activity;
    }
}
