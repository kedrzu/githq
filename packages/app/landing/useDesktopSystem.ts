import { onMounted, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

import { detectDesktopSystem } from './desktopBuilds.js';
import type { DesktopSystem } from './desktopBuilds.js';

/**
 * The visitor's system, known once mounted: the prerendered page can't know it, and hydrating must match the server's
 * HTML. `null` until then, and for a visitor with nothing to install.
 */
export function useDesktopSystem(): Readonly<ShallowRef<DesktopSystem | null>> {
    const system = shallowRef<DesktopSystem | null>(null);

    onMounted(() => {
        system.value = detectDesktopSystem(navigator);
    });

    return system;
}
