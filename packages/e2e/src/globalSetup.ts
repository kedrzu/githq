import type { FullConfig } from '@playwright/test';

import { OAUTH_AUTHORIZE_PATH, OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

import { DESKTOP_PROJECT, E2E_CLIENT_ID } from './localApp.js';

// Before any test, after the web servers are up: proves that the tests run against the app on this machine, its
// Worker with the dummy OAuth App of `worker.vars` and this server's callback — never a real OAuth App — serving
// the build's assets, which the tests themselves take from the disk (`localAssets` in `fixtures.ts`), and the
// desktop app's build served the way its window loads it.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export default async function globalSetup(config: FullConfig) {
    for (const project of config.projects) {
        const baseURL = project.use.baseURL;
        if (!baseURL || !LOCAL_HOSTS.has(new URL(baseURL).hostname)) {
            throw new Error(`e2e runs against the app on this machine only; project "${project.name}" has ${baseURL}`);
        }

        if (project.name === DESKTOP_PROJECT) {
            await checkDesktopServer(baseURL);
        } else {
            await checkWorker(baseURL);
            await checkWorkerAssets(baseURL);
        }
    }
}

/** The desktop build's server answers a deep link with the app, as the desktop app's window does. */
async function checkDesktopServer(baseURL: string) {
    const response = await fetch(new URL('/acme/web/issues/1', baseURL));
    const html = await response.text();
    if (response.status !== 200 || !html.includes('id="__nuxt"')) {
        throw new Error(
            `The desktop build's server at ${baseURL} does not answer a deep link with the app: ${response.status} (\`src/desktop/serveDesktopApp.ts\`)`,
        );
    }
}

/** The Worker sends the browser to GitHub with the e2e client and a callback on `baseURL`. */
async function checkWorker(baseURL: string) {
    const response = await fetch(new URL(`${OAUTH_AUTHORIZE_PATH}?state=e2eGlobalSetupState`, baseURL), {
        redirect: 'manual',
    });
    const location = response.headers.get('location');
    const query = location === null ? undefined : new URL(location).searchParams;
    const expectedCallback = new URL(OAUTH_CALLBACK_PATH, baseURL).href;

    if (query?.get('client_id') !== E2E_CLIENT_ID || query.get('redirect_uri') !== expectedCallback) {
        throw new Error(
            `The Worker at ${baseURL} is not configured for e2e: ${OAUTH_AUTHORIZE_PATH} answered ${response.status} to ${location ?? 'nowhere'}; expected client_id=${E2E_CLIENT_ID} and redirect_uri=${expectedCallback} (\`worker.vars\`, \`--host\` in playwright.config.ts)`,
        );
    }
}

/** The Worker serves the build's assets the page asks for, cached for good, as Cloudflare does in production. */
async function checkWorkerAssets(baseURL: string) {
    const html = await (await fetch(new URL('/', baseURL))).text();
    const script = /\/_nuxt\/[^"']+\.js/.exec(html)?.[0];
    if (script === undefined) {
        throw new Error(`The page at ${baseURL}/ names no /_nuxt/ script`);
    }

    const response = await fetch(new URL(script, baseURL));
    const cacheControl = response.headers.get('cache-control');
    if (response.status !== 200 || !cacheControl?.includes('immutable')) {
        throw new Error(
            `The Worker at ${baseURL} does not serve the build's assets: ${script} answered ${response.status} with Cache-Control ${cacheControl} (\`assets\` in \`packages/worker/wrangler.jsonc\`, \`--assets\` in playwright.config.ts)`,
        );
    }
}
