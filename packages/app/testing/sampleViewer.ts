import type { Viewer } from '@/auth/AuthStore.js';

/** A signed-in user for stories, with an avatar that needs no network. */
export const SAMPLE_VIEWER: Viewer = {
    login: 'kedrzu',
    name: 'Michał Kędrzyński',
    avatarUrl: `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#C9A26B"/></svg>',
    )}`,
};
