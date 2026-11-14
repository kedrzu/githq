import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { onScopeDispose, watchEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { PhonePart } from './PhoneLayout.js';
import { PhoneLayout } from './PhoneLayout.js';

/**
 * Puts the part a list screen shows into the phone's command line (mobile D17) while the screen is on view and the phone
 * layout is on, and takes it away when the screen goes — unless the next screen has put its own there already, as it
 * mounts before this one unmounts.
 */
export function usePhonePart(part: MaybeRefOrGetter<PhonePart | null>) {
    const phone = useService(PhoneLayout);
    const partRef = makeRef(part);
    let shown: PhonePart | null = null;

    watchEffect(() => {
        shown = phone.active ? partRef.value : null;
        phone.setPart(shown);
    });

    onScopeDispose(() => {
        if (shown !== null && phone.part === shown) {
            phone.setPart(null);
        }
    });
}
