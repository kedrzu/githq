import { onTestFinished } from 'vitest';
import { effectScope } from 'vue';

import { useTabFocus } from '@/utils/useTabFocus.js';

/** The shell's tracker of Tab focus, in a spec that mounts no shell, until the test ends. */
export function trackTabFocus() {
    const scope = effectScope();
    scope.run(useTabFocus);
    onTestFinished(() => scope.stop());
}
