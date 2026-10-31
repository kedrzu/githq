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
