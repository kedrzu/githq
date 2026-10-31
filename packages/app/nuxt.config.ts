import { defineNuxtConfig } from 'nuxt/config';

import { cssOptions } from './viteShared.js';

/**
 * What `nuxt generate` builds for, from `GITHQ_TARGET` — set by the package's scripts, never guessed:
 *
 * - `production` (`build`): into `.output/public`, the folder the Worker serves; no development sign-in.
 *   `scripts/checkProductionBuild.ts` checks it after every build.
 * - `local` (`build:local`, for the e2e tests): the same app plus the development sign-in with a pasted
 *   token (`auth/DevTokenForm.vue`), into its own `.output-local/public`, which nothing deploys;
 *   `scripts/checkLocalBuild.ts` checks it.
 *
 * Unset (`nuxt dev`, `nuxi typecheck`) it is `production`; `nuxt dev` has the development sign-in on its own
 * (`import.meta.dev`). Any other value fails the build.
 */
const TARGET = readTarget(process.env.GITHQ_TARGET);
const LOCAL_BUILD = TARGET === 'local';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    // Pinned instead of left to Nuxt's guess: Nuxt switches `srcDir` to `app/` as soon as that folder holds
    // anything besides `router.options.ts`.
    srcDir: '.',
    ssr: false,
    devtools: { enabled: true },
    // The port the app is opened on in development; the Worker runs next to it on 8788 (`$development`).
    devServer: {
        port: 8787,
    },
    app: {
        head: {
            title: 'githq',
            htmlAttrs: { lang: 'en' },
            meta: [{ name: 'theme-color', content: '#0e1013' }],
            // Written by `scripts/generateIcons.ts`.
            link: [
                { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
                { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
            ],
        },
    },
    typescript: {
        typeCheck: true,
        strict: true,
    },
    // No auto-registered components and no auto-imports: everything is imported explicitly.
    components: false,
    imports: {
        autoImport: false,
        dirs: [],
    },
    hooks: {
        // Routes are declared only in `app/router.options.ts`. A file Nuxt picks up as a file-based route
        // (anything in `pages/`) fails the build instead of being silently ignored.
        'pages:resolved'(pages) {
            if (pages.length > 0) {
                const files = pages.map(page => page.file ?? page.path).join(', ');
                throw new Error(
                    `File-based routing is not used here; declare routes in app/router.options.ts (${files})`,
                );
            }
        },
    },
    // The local build goes to folders of its own: its output, so a production deploy can never pick it up, and
    // its build files, so it can run while `nuxt dev` (which uses `.nuxt`) is up.
    ...(LOCAL_BUILD ? { buildDir: '.nuxt-local', nitro: { output: { dir: '.output-local' } } } : {}),
    // The app builds to static files only (`nuxt generate` → `.output/public`), which Cloudflare serves as the
    // assets of the githq Worker (`packages/worker/wrangler.jsonc`) without running any code. The API is that
    // Worker, on the same domain: the app calls `/api/...`, and under `nuxt dev` those calls go to the Worker in
    // `wrangler dev` (`bun --cwd packages/worker dev`, port 8788), `/api` prefix kept.
    $development: {
        nitro: {
            routeRules: {
                // `redirect: 'manual'` hands the Worker's redirects to the browser: by default the proxy
                // follows them itself, and `/api/auth/authorize` would answer with GitHub's sign-in page.
                '/api/**': { proxy: { to: 'http://localhost:8788/api/**', fetchOptions: { redirect: 'manual' } } },
            },
        },
    },
    logLevel: 'silent',
    vite: {
        clearScreen: false,
        logLevel: 'warn',
        css: cssOptions,
        define: {
            // `shims.d.ts`: a literal in the built code, so the production build drops what it guards.
            __LOCAL_BUILD__: JSON.stringify(LOCAL_BUILD),
        },
    },
});

function readTarget(value: string | undefined): 'local' | 'production' {
    if (value === undefined || value === 'production' || value === 'local') {
        return value ?? 'production';
    }

    throw new Error(`GITHQ_TARGET must be "production" or "local", not "${value}"`);
}
