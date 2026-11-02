import type { RouteLocationRaw, Router } from 'vue-router';

/**
 * Goes back where the user came from: the previous entry when it is the app's (vue-router keeps it in the history
 * entry's state), else — opened from an address, or the app's first page — to `fallback`, in place of this entry.
 * @util
 */
export function goBack(router: Router, fallback: RouteLocationRaw) {
    if (router.options.history.state.back == null) {
        void router.replace(fallback);
    } else {
        router.back();
    }
}
