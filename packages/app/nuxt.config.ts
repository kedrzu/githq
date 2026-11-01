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
 * - `desktop` (`build:desktop`, and `dev:desktop` for `nuxt dev` under `tauri dev`): the app the desktop app
 *   (`packages/desktop`) bundles, with its desktop code (`desktop/`), into its own `.output-desktop/public`;
 *   `scripts/checkDesktopBuild.ts` checks it.
 *
 * Unset (`nuxt dev`, `nuxi typecheck`) it is `production`; `nuxt dev` has the development sign-in on its own
 * (`import.meta.dev`). Any other value fails the build.
 */
const TARGET = readTarget(process.env.GITHQ_TARGET);
const LOCAL_BUILD = TARGET === 'local';
const DESKTOP = TARGET === 'desktop';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    // Pinned instead of left to Nuxt's guess: Nuxt switches `srcDir` to `app/` as soon as that folder holds
    // anything besides `router.options.ts`.
    srcDir: '.',
    // Server rendering exists only to prerender the landing page at `/` (signed out) into `_landing.html`,
    // which the Worker serves to a visitor without the signed-in hint. Every other route, and `index.html` —
    // the shell every deep link loads — stays a SPA (`routeRules`). `nuxt dev` is a SPA throughout
    // (`$development`). So is the desktop build: its window has no landing page in front of the sign-in (D21), and
    // `/` is `index.html`, the shell.
    ssr: !DESKTOP,
    // `/**` matches `/` too (Nitro merges every matching rule), so `/` needs a rule of its own.
    routeRules: DESKTOP
        ? {}
        : {
              '/**': { ssr: false },
              '/': { ssr: true },
          },
    experimental: {
        // The prerendered page carries its payload inline; the browser never asks for `_payload.json`.
        payloadExtraction: false,
    },
    features: {
        // Linked, not inlined: Nuxt inlines the global styles into server-rendered pages only and then leaves
        // them out of the SPA shell (`index.html`) altogether.
        inlineStyles: false,
    },
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
            // The icons are written by `scripts/generateIcons.ts`; the manifest makes githq installable.
            link: [
                { rel: 'manifest', href: '/manifest.webmanifest' },
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
    // The local and desktop builds go to folders of their own: their output, so a production deploy can never
    // pick it up, and their build files, so each can run while `nuxt dev` (which uses `.nuxt`) is up.
    ...(LOCAL_BUILD ? { buildDir: '.nuxt-local' } : {}),
    ...(DESKTOP ? { buildDir: '.nuxt-desktop' } : {}),
    nitro: {
        ...(LOCAL_BUILD ? { output: { dir: '.output-local' } } : {}),
        ...(DESKTOP ? { output: { dir: '.output-desktop' } } : {}),
        // `/` is the landing page. `index.html` is the shell: with `ssr: true` Nuxt adds it to the prerendered routes
        // only when told to, and renders it with no server rendering whatever the route rules say. The desktop build
        // is a SPA, whose `index.html` is the shell anyway.
        prerender: DESKTOP ? {} : { routes: ['/', '/index.html'], crawlLinks: false },
        hooks: DESKTOP
            ? {}
            : {
                  // The landing page goes to `_landing.html`, leaving `index.html` to the shell.
                  'prerender:generate'(route) {
                      if (route.route === '/') {
                          route.fileName = '/_landing.html';
                      }
                  },
              },
    },
    // The app builds to static files only (`nuxt generate` → `.output/public`), which Cloudflare serves as the
    // assets of the githq Worker (`packages/worker/wrangler.jsonc`) without running any code. The API is that
    // Worker, on the same domain: the app calls `/api/...`, and under `nuxt dev` those calls go to the Worker in
    // `wrangler dev` (`bun --cwd packages/worker dev`, port 8788), `/api` prefix kept.
    $development: {
        ssr: false,
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
            __DESKTOP__: JSON.stringify(DESKTOP),
            __GITHUB_CLIENT_ID__: JSON.stringify((DESKTOP && process.env.GITHQ_GITHUB_CLIENT_ID) || null),
        },
    },
});

function readTarget(value: string | undefined): 'desktop' | 'local' | 'production' {
    if (value === undefined || value === 'production' || value === 'local' || value === 'desktop') {
        return value ?? 'production';
    }

    throw new Error(`GITHQ_TARGET must be "production", "local" or "desktop", not "${value}"`);
}
