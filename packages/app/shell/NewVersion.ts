import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { Browser } from '@/services/Browser.js';

/**
 * A newer githq deployed while this page runs, on the web (the desktop app has its own updater, `AppUpdate`). Nuxt
 * polls for a new build and says so through `app:manifest:update`, which `iocPlugin` passes to {@link announce}; the
 * page reloads only at the user's word (`NewVersionToast.vue`).
 */
export const NewVersion = defineService({
    name: 'NewVersion',
    deps: {
        browser: Browser,
    },
    setup({ browser }) {
        const outRef = shallowRef(false);

        return {
            /** A newer version is out and the user has not dismissed it; reactive. */
            get out() {
                return outRef.value;
            },
            /** A newer version is out. */
            announce: () => {
                outRef.value = true;
            },
            /** The user dismissed it: Nuxt says so once a page, so it does not come back until the next load. */
            dismiss: () => {
                outRef.value = false;
            },
            /** Loads the newer version. */
            reload: () => browser.reload(),
        };
    },
});
