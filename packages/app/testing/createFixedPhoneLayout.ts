import { shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { PhoneLayout, PhonePart } from '@/shell/PhoneLayout.js';

/**
 * A `PhoneLayout` on or off whatever the window's width, for a spec or story: they run in a frame narrower than the
 * phone's width, where the real one is always on. The places panel and the part still change as the app sets them; a ref
 * for `active` stands for the window crossing the phone's width.
 */
export function createFixedPhoneLayout(active: MaybeRefOrGetter<boolean>): PhoneLayout {
    const placesOpen = shallowRef(false);
    const part = shallowRef<PhonePart | null>(null);
    return {
        get active() {
            return toValue(active);
        },
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
