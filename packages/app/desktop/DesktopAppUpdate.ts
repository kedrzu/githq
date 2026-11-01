import type { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import type { AppUpdateShape } from '@/services/AppUpdate.js';

import type { NativeBridgeShape } from './NativeBridge.js';

/** The parameters of {@link createDesktopAppUpdate}. */
export interface CreateDesktopAppUpdateParams {
    readonly bridge: NativeBridgeShape;
    readonly logger: Logger;
}

/**
 * The desktop app's updates: the native side checks, downloads and readies them (`src-tauri/src/updater.rs`), and
 * says when one is ready; restarting into it is the user's call alone. It listens first and then asks once, so an
 * update readied before the app started listening is offered too.
 */
export function createDesktopAppUpdate({ bridge, logger }: CreateDesktopAppUpdateParams): AppUpdateShape {
    const version = shallowRef<string | null>(null);
    const dismissed = shallowRef(false);

    void watchUpdates();

    return {
        get readyVersion() {
            return dismissed.value ? null : version.value;
        },
        restart: () => {
            bridge.restartToUpdate().catch((error: unknown) => {
                logger.warn('Could not restart into the update', { error });
            });
        },
        later: () => {
            dismissed.value = true;
        },
    };

    async function watchUpdates() {
        try {
            await bridge.onUpdateReady(ready => {
                version.value = ready;
            });
            const ready = await bridge.updateStatus();
            if (ready !== null) {
                version.value = ready;
            }
        } catch (error) {
            logger.warn('Could not listen for app updates', { error });
        }
    }
}
