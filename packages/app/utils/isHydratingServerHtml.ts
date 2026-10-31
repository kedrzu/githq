import type { NuxtApp } from 'nuxt/app';

/**
 * Whether the app is hydrating HTML the server rendered (the prerendered landing page), so what renders now must
 * match it. Nuxt's `isHydrating` alone is also true for the first render of an app that was not server-rendered,
 * where there is nothing to match — as Nuxt's own `useAsyncData` tells the two apart.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isHydratingServerHtml(nuxtApp: NuxtApp): boolean {
    return nuxtApp.isHydrating === true && nuxtApp.payload.serverRendered === true;
}
