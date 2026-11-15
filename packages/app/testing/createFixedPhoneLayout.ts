import { shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { PhoneLayout, PhonePart } from '@/shell/PhoneLayout.js';

/**
 * A `PhoneLayout` on or off whatever the window's width, for a spec or story: they run in a frame narrower than the
 * phone's width, where the real one is always on. The places panel, the part and the tasks open still change as the app sets them; a ref
 * for `active` stands for the window crossing the phone's width.
 */
export function createFixedPhoneLayout(active: MaybeRefOrGetter<boolean>): PhoneLayout {
    const placesOpen = shallowRef(false);
    const part = shallowRef<PhonePart | null>(null);
    const tasks = shallowRef(0);
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
        get taskOpen() {
            return tasks.value > 0;
        },
        setPart(value) {
            part.value = value;
        },
        openTask() {
            tasks.value++;
            let open = true;
            return () => {
                if (open) {
                    open = false;
                    tasks.value--;
                }
            };
        },
    };
}
