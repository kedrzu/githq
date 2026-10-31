import { createGitHubRequester } from '@githq/github/createGitHubRequester.js';
import { getSdk } from '@githq/github/generated.gen.js';
import { defineFactory } from '@nzyme/ioc/Factory.js';

import { Browser } from './Browser.js';
import { GitHubRateLimitStore } from './GitHubRateLimitStore.js';

/**
 * The typed GitHub GraphQL SDK for one token: `factory(() => token).Viewer()`. Every answer's allowance goes
 * to {@link GitHubRateLimitStore}. Takes the token as a getter, so an SDK made once follows a token that
 * changes.
 */
export const GitHubSdkFactory = defineFactory({
    name: 'GitHubSdkFactory',
    deps: {
        browser: Browser,
        rateLimit: GitHubRateLimitStore,
    },
    setup({ browser, rateLimit }, getToken: () => string) {
        return getSdk(
            createGitHubRequester({
                getToken,
                fetch: browser.fetch,
                onRateLimit: limit => rateLimit.update(limit),
            }),
        );
    },
});
