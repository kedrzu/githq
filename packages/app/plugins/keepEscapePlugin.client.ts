import { defineNuxtPlugin } from 'nuxt/app';

import { keepEscapeInPage } from '@/utils/keepEscapeInPage.js';

/** Escape never takes the app out of full screen, whatever is on the screen. */
export default defineNuxtPlugin({
    name: 'keep-escape-plugin',
    setup() {
        keepEscapeInPage();
    },
});
