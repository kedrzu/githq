// Types for tools that cannot read single-file components themselves (tsgo, oxlint's type-aware rules).
// vue-tsc resolves `.vue` files on its own and never falls back to this declaration.
declare module '*.vue' {
    import type { DefineComponent } from 'vue';

    const component: DefineComponent;
    export default component;
}

/**
 * `true` in the local build (`GITHQ_TARGET=local`, `nuxt.config.ts`): the built app with the development
 * sign-in (`auth/DevTokenForm.vue`) — what the e2e tests run. `false` in the production build, which drops the
 * code behind it. A literal Vite writes into the code at build time.
 */
declare const __LOCAL_BUILD__: boolean;

/**
 * `true` in the desktop build (`GITHQ_TARGET=desktop`, `nuxt.config.ts`): the app the desktop app bundles, with its
 * desktop code (`desktop/installDesktop.ts`). `false` in the web builds, which drop the code behind it — nothing of
 * the desktop app ships to githq.dev. A literal Vite writes into the code at build time.
 */
declare const __DESKTOP__: boolean;

/**
 * The client ID of the OAuth App the desktop app signs in with (`GITHQ_GITHUB_CLIENT_ID` at build time, the one its
 * native side uses too) — in the desktop build only; `null` in the web builds, which link through the Worker, and in a
 * desktop build made without it.
 */
declare const __GITHUB_CLIENT_ID__: string | null;
