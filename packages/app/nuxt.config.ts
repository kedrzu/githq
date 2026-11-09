import { getOAuthClientId } from '@githq/github/oauth.js';
import { simplifyAliasesModule } from '@nzyme/nuxt-tools';
import Beasties from 'beasties';
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
    // The landing page's screenshots (`<NuxtImg>`), resized at prerender into `_ipx/` for the widths their `sizes`
    // ask for. Every URL carries one modifier, the size (`s_1200x750`): no `quality` or `format`, as the sources
    // are WebP already. Two would be joined by `&`, which Cloudflare's assets answer with a redirect to `%26`.
    modules: ['@nuxt/image', simplifyAliasesModule()],
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
            meta: [{ name: 'theme-color', content: '#0d1117' }],
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
        prerender: DESKTOP ? {} : { routes: ['/', '/index.html'], crawlLinks: false, failOnError: true },
        hooks: DESKTOP
            ? {}
            : {
                  // The landing page goes to `_landing.html`, leaving `index.html` to the shell, with its critical CSS
                  // inlined: the rules it uses go into the page, and its stylesheets load without blocking the
                  // first paint (`media="print"` until loaded). The shell stays as it is.
                  async 'prerender:generate'(route, nitro) {
                      if (route.route === '/') {
                          route.fileName = '/_landing.html';
                          route.contents = await inlineCriticalCss(route.contents ?? '', nitro.options.publicAssets);
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
                // The docs (`packages/docs`, `bun run dev` starts them), from VitePress's dev server on 8789 under the
                // same `/docs/` as in production. Its HMR socket goes to 8789 directly (`vite.server.hmr` in its
                // config): this proxy carries no WebSocket. `/docs` gets the home too, not the SPA: a `redirect` rule
                // here would make Nuxt's router ask for file-based pages. The proxy drops a trailing slash, hence
                // the target spelled out.
                '/docs': { proxy: { to: 'http://localhost:8789/docs/' } },
                '/docs/**': { proxy: { to: 'http://localhost:8789/docs/**', fetchOptions: { redirect: 'manual' } } },
            },
        },
    },
    logLevel: 'silent',
    vite: {
        clearScreen: false,
        logLevel: 'warn',
        css: cssOptions,
        // Code review's tokenizer loads a language's grammar when first needed, which only a module worker can.
        worker: { format: 'es' },
        define: {
            // `shims.d.ts`: a literal in the built code, so the production build drops what it guards.
            __LOCAL_BUILD__: JSON.stringify(LOCAL_BUILD),
            __DESKTOP__: JSON.stringify(DESKTOP),
            __GITHUB_CLIENT_ID__: JSON.stringify(
                DESKTOP ? (getOAuthClientId(process.env.GITHQ_ENV ?? 'dev') ?? null) : null,
            ),
            // Only githq.dev's Worker has the production OAuth App's secret; any other build reaches its own origin's.
            __WORKER_ORIGIN__: JSON.stringify(DESKTOP && process.env.GITHQ_ENV === 'prod' ? 'https://githq.dev' : ''),
        },
    },
});

/**
 * Faces of fonts every system has, scaled to take the room of the page's own fonts (`$font-family-*` in `tokens.scss`),
 * so that nothing moves on the prerendered page when those arrive. Measured in Chromium against the `@fontsource`
 * files, on the page's own words: `size-adjust` is the ratio of the widths, the other two the font's ascent and descent
 * over it. A system without Arial falls to the next font in the stack, as it did before.
 */
const FONT_FALLBACKS = [
    { family: 'Inter Fallback', local: 'Arial', weight: '400 500', size: 107.35, ascent: 90.36, descent: 22.36 },
    { family: 'Inter Fallback', local: 'Arial Bold', weight: '600 700', size: 100.65, ascent: 96.37, descent: 23.84 },
    { family: 'Geist Fallback', local: 'Arial', weight: '400 500', size: 104.99, ascent: 96.2, descent: 27.62 },
    { family: 'Geist Fallback', local: 'Arial Bold', weight: '600 700', size: 100.31, ascent: 100.69, descent: 28.91 },
    {
        family: 'JetBrains Mono Fallback',
        local: 'Courier New',
        weight: '400 700',
        size: 99.98,
        ascent: 102.02,
        descent: 30,
    },
]
    .map(
        face =>
            `@font-face{font-family:'${face.family}';src:local('${face.local}');font-weight:${face.weight};size-adjust:${face.size}%;ascent-override:${face.ascent}%;descent-override:${face.descent}%;line-gap-override:0%}`,
    )
    .join('');

/**
 * Inlines the CSS `html` uses (Beasties, the maintained fork of Critters). While Nitro prerenders, the client's
 * files are not in the output yet: the stylesheets are read from the folder Nitro serves `/_nuxt` from.
 */
async function inlineCriticalCss(html: string, publicAssets: readonly { baseURL?: string; dir: string }[]) {
    const assets = publicAssets.find(asset => asset.baseURL === '/_nuxt');
    if (!assets) {
        throw new Error('The client build (`/_nuxt`) is not among Nitro public assets: no critical CSS to inline');
    }

    const beasties = new Beasties({
        path: assets.dir,
        publicPath: '/_nuxt/',
        preload: 'media',
        inlineFonts: false,
        preloadFonts: false,
        logLevel: 'warn',
    });
    // After Beasties, which drops every `@font-face` from what it inlines.
    return (await beasties.process(html)).replace('</head>', `<style>${FONT_FALLBACKS}</style></head>`);
}

function readTarget(value: string | undefined): 'desktop' | 'local' | 'production' {
    if (value === undefined || value === 'production' || value === 'local' || value === 'desktop') {
        return value ?? 'production';
    }

    throw new Error(`GITHQ_TARGET must be "production", "local" or "desktop", not "${value}"`);
}
