import type { FullConfig } from '@playwright/test';

import { OAUTH_AUTHORIZE_PATH, OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

import { E2E_CLIENT_ID } from './localApp.js';

// Before any test, after the web server is up: proves that the tests run against the app on this machine, its
// Worker with the dummy OAuth App of `worker.vars` and this server's callback — never a real OAuth App.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export default async function globalSetup(config: FullConfig) {
    for (const project of config.projects) {
        const baseURL = project.use.baseURL;
        if (!baseURL || !LOCAL_HOSTS.has(new URL(baseURL).hostname)) {
            throw new Error(`e2e runs against the app on this machine only; project "${project.name}" has ${baseURL}`);
        }

        await checkWorker(baseURL);
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
