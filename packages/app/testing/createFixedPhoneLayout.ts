import { shallowRef } from 'vue';

import type { PhoneLayout, PhonePart } from '@/shell/PhoneLayout.js';

/**
 * A `PhoneLayout` on or off whatever the window's width, for a spec or story: they run in a frame narrower than the
 * phone's width, where the real one is always on. The places panel and the part still change as the app sets them.
 */
export function createFixedPhoneLayout(active: boolean): PhoneLayout {
    const placesOpen = shallowRef(false);
    const part = shallowRef<PhonePart | null>(null);
    return {
        active,
        get placesOpen() {
            return placesOpen.value;
        },
        get part() {
            return part.value;
        },
        setPlacesOpen(open) {
            placesOpen.value = open;
        },
        setPart(value) {
            part.value = value;
        },
    };
}
