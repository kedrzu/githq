import { OAUTH_REFRESH_PATH, OAUTH_REVOKE_PATH } from '@githq/github/oauth.js';

import { test as base } from '../fixtures.js';
import { E2E_DESKTOP_BASE_URL } from '../localApp.js';

import { FakeNativeBridge } from './FakeNativeBridge.js';

export interface DesktopFixtures {
    /** The desktop app's native side, as this test answers it; set up in every test, used or not. */
    native: FakeNativeBridge;
    /**
     * The requests the app made to a githq server — githq.dev, or `/api/*` of the app's own origin — which the desktop
     * app never needs: it talks to GitHub alone. Any fails the test when it ends; githq.dev is never reached. The
     * exceptions are what only the client secret can do — the revocation of the token on signing out and the renewal of
     * an expiring one — which a build that is not production's asks of its own origin and the GitHub mock answers
     * (`GitHubMock.revokedTokens`, `GitHubMock.refreshedTokens`).
     */
    githqRequests: readonly string[];
}

/** The e2e `test` of the desktop app's build: GitHub mocked ({@link base}), the native side faked. */
export const test = base.extend<DesktopFixtures>({
    native: [
        async ({ context }, use) => {
            const native = new FakeNativeBridge();
            await native.install(context);
            await use(native);
            native.assertKnownCommands();
        },
        { auto: true },
    ],
    githqRequests: [
        async ({ context }, use) => {
            const requests: string[] = [];
            context.on('request', request => {
                const url = new URL(request.url());
                const ownApi =
                    url.origin === E2E_DESKTOP_BASE_URL &&
                    url.pathname.startsWith('/api/') &&
                    url.pathname !== OAUTH_REVOKE_PATH &&
                    url.pathname !== OAUTH_REFRESH_PATH;
                if (isGitHqDev(url) || ownApi) {
                    requests.push(`${request.method()} ${url.href}`);
                }
            });
            await context.route(isGitHqDev, route => route.abort('blockedbyclient'));
            await use(requests);
            if (requests.length > 0) {
                throw new Error(`The desktop app made requests to githq's servers:\n${requests.join('\n')}`);
            }
        },
        { auto: true },
    ],
});

export { expect } from '../fixtures.js';

function isGitHqDev(url: URL) {
    return url.hostname === 'githq.dev' || url.hostname.endsWith('.githq.dev');
}
