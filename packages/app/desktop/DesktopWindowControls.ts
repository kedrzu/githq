import type { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import type { WindowControlsShape } from '@/services/WindowControls.js';

import type { NativeBridgeShape } from './NativeBridge.js';

/** The parameters of {@link createDesktopWindowControls}. */
export interface CreateDesktopWindowControlsParams {
    readonly bridge: NativeBridgeShape;
    readonly logger: Logger;
}

/**
 * macOS's window controls over the desktop app's window, gone in full screen. The window has no event for full screen
 * itself, but it resizes as the change ends, so each resize asks again. It listens first and then asks once, for a
 * window already in full screen when the page loaded.
 */
export function createDesktopWindowControls({
    bridge,
    logger,
}: CreateDesktopWindowControlsParams): WindowControlsShape {
    const fullscreen = shallowRef(false);
    /** The last question asked: resizes come fast, and an older answer may arrive after a newer one. */
    let lastAsked = 0;

    void watchFullscreen();

    return {
        get overlaid() {
            return !fullscreen.value;
        },
    };

    async function watchFullscreen() {
        try {
            await bridge.onWindowResized(() => void askFullscreen());
        } catch (error) {
            logger.warn('Could not listen to the window resizing', { error });
        }

        await askFullscreen();
    }

    async function askFullscreen() {
        const asked = ++lastAsked;
        try {
            const answer = await bridge.isFullscreen();
            if (asked === lastAsked) {
                fullscreen.value = answer;
            }
        } catch (error) {
            logger.warn('Could not ask whether the window is in full screen', { error });
        }
    }
}
