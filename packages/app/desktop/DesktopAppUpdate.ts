import type { Logger } from '@nzyme/logging/Logger.js';
import { computed, shallowRef } from 'vue';

import type { AppUpdateShape, UpdateNotice, UpdateState } from '@/services/AppUpdate.js';

import type { NativeBridgeShape } from './NativeBridge.js';

/** How long an outcome with nothing left to do stays (U22). */
const OUTCOME_MS = 5000;

/** The parameters of {@link createDesktopAppUpdate}. */
export interface CreateDesktopAppUpdateParams {
    readonly bridge: NativeBridgeShape;
    readonly logger: Logger;
    /** How long "up to date" and "no release" stay. */
    readonly outcomeMs?: number;
}

/**
 * The desktop app's updates: the native side checks, downloads and installs them (`src-tauri/src/updater.rs`) and
 * sends its whole state on every change; restarting into one is the user's call alone. It listens first and then asks
 * once, so nothing that happened before the app started listening is missed. What the status bar says is derived here.
 */
export function createDesktopAppUpdate({
    bridge,
    logger,
    outcomeMs = OUTCOME_MS,
}: CreateDesktopAppUpdateParams): AppUpdateShape {
    const state = shallowRef<UpdateState | null>(null);
    /**
     * How the last check the user asked for ended, held apart from the state: a timed check replaces the state, and a
     * failure stays until the user closes it.
     */
    const outcome = shallowRef<UpdateNotice | null>(null);
    /** "Later" was pressed: until the app next starts, or the user checks again. */
    const hidden = shallowRef(false);
    const notice = computed(getNotice);
    /** The last outcome was closed or ran out; the state may still repeat it, until the user checks again. */
    let closed = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;

    void watchUpdates();

    return {
        get state() {
            return state.value;
        },
        get readyVersion() {
            const activity = state.value?.activity;
            return activity?.kind === 'ready' && !hidden.value ? activity.version : null;
        },
        get notice() {
            return notice.value;
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
            hidden.value = true;
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
                    hidden.value = false;
                }

                return;
            case 'ready':
            case 'installing':
            case 'installFailed':
                // Something to decide is on offer: an older outcome has no more to say, then or after "Later".
                clearTimeout(expiry);
                outcome.value = null;
                return;
            case 'upToDate':
                holdOutcome(next, { kind: 'upToDate', version: next.version }, true);
                return;
            case 'noRelease':
                holdOutcome(next, activity, true);
                return;
            case 'failed':
                holdOutcome(next, activity, false);
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
                return hidden.value ? null : activity;
            case 'checking':
            case 'downloading':
                return manual ? activity : outcome.value;
            default:
                return outcome.value;
        }
    }
}
