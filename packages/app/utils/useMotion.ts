import { onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

import { prefersReducedMotion } from '@/landing/prefersReducedMotion.js';

/**
 * Whether the app's short animations play here, as the `motion` mixin decides it (`styles/tokens.scss`): the shell's
 * `data-motion` on `<html>` and no reduced motion asked for. For motion run by script, which the mixin can't hold back;
 * follows the attribute as the shell sets and drops it.
 *
 * @util
 */
export function useMotion(): Readonly<Ref<boolean>> {
    const root = document.documentElement;
    const on = ref(read());
    const observer = new MutationObserver(() => {
        on.value = read();
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-motion'] });
    onScopeDispose(() => observer.disconnect());

    return readonly(on);

    function read() {
        return root.dataset.motion === 'on' && !prefersReducedMotion();
    }
}
