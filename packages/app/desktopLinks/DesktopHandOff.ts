import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { Browser } from '@/services/Browser.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';

import { getDesktopLinkUrl } from './getDesktopLinkUrl.js';

/** What `sessionStorage` keeps once the user chose "Open here instead": this tab is never handed off again. */
const STAY_HERE_KEY = 'githq.stayHere';

/**
 * Opening githq links in the desktop app, in the browser (web builds only). The decision is taken once per page load,
 * on the page's first navigation: only a first address that is a shell screen with the user signed in may be handed
 * off — a shell mounted later, after a sign-in or a step of the first sign-in, never is. It is handed off when this
 * browser opted in (`LocalPreferences.openLinksInDesktop`) and the tab has not chosen to stay; at most once per page
 * load. A service, so that a shell mounted again does not hand off again.
 */
export type DesktopHandOff = Resolved<typeof DesktopHandOff>;
export const DesktopHandOff = defineService({
    name: 'DesktopHandOff',
    deps: {
        browser: Browser,
        preferences: LocalPreferences,
    },
    setup({ browser, preferences }) {
        /** The first address, while it may be handed off; `null` once it was, or when it never could be. */
        let candidate: string | null = null;
        const shown = shallowRef(false);

        return {
            /** Whether the hand-off screen shows. */
            get shown() {
                return shown.value;
            },
            /** The page's first navigation ended on `fullPath`: a shell screen with the user signed in, or not (`null`). */
            recordFirstRoute(fullPath: string | null) {
                candidate = fullPath;
            },
            /** Opens the first address in the app when it is due (see above); a no-op after the first call. */
            handOffIfDue() {
                const fullPath = candidate;
                candidate = null;
                if (fullPath === null || !preferences.openLinksInDesktop.value) {
                    return;
                }

                if (browser.sessionStorage.getItem(STAY_HERE_KEY) !== null) {
                    return;
                }

                shown.value = true;
                browser.navigate(getDesktopLinkUrl(fullPath));
            },
            /** "Open here instead": this tab stays on githq, now and after a reload. */
            stayHere() {
                browser.sessionStorage.setItem(STAY_HERE_KEY, 'true');
                shown.value = false;
            },
            /** "Don't open links in the app": the opt-in is turned off. */
            turnOff() {
                preferences.openLinksInDesktop.value = false;
                shown.value = false;
            },
        };
    },
});
