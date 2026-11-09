import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

/**
 * The Mac's ⌘W, which in the desktop app does not close its one window, as that would quit (`menu.rs` in
 * `packages/desktop`): each press counted, for `QuitHintToast.vue` to say that ⌘Q quits. `installDesktop` counts them.
 */
export type QuitHint = Resolved<typeof QuitHint>;
export const QuitHint = defineService({
    name: 'QuitHint',
    setup() {
        const pressesRef = shallowRef(0);

        return {
            /** How many times ⌘W was pressed since the app started; reactive. */
            get presses() {
                return pressesRef.value;
            },
            /** Counts a press of ⌘W. */
            press() {
                pressesRef.value++;
            },
        };
    },
});
