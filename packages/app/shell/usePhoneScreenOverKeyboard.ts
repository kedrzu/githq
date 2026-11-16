import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';
import type { ComputedRef, StyleValue } from 'vue';

import { PhoneLayout } from './PhoneLayout.js';
import { useVisualViewport } from './useVisualViewport.js';

/**
 * On a phone, the inline style of a screen covering what the on-screen keyboard leaves of the window
 * (`useVisualViewport`): pinned across the window with its bottom on the keyboard's top, as tall as the visual viewport,
 * so what it pins to its own bottom rides above the keyboard. `undefined` off a phone, where the screen keeps its layout.
 * @util
 */
export function usePhoneScreenOverKeyboard(): ComputedRef<StyleValue | undefined> {
    const phone = useService(PhoneLayout);
    const viewport = useVisualViewport();

    return computed(() =>
        phone.active
            ? {
                  position: 'fixed',
                  right: 0,
                  left: 0,
                  bottom: `${viewport.bottomInset}px`,
                  height: `${viewport.height}px`,
              }
            : undefined,
    );
}
