import { createGitHubRequester } from '@githq/github/createGitHubRequester.js';
import { defineFactory } from '@nzyme/ioc/Factory.js';

import { Browser } from './Browser.js';
import { GitHubRateLimitStore } from './GitHubRateLimitStore.js';

/**
 * The GitHub GraphQL requester for one token, under the SDK and under the queries the SDK can't express. Every answer's
 * allowance goes to {@link GitHubRateLimitStore}.
 */
export const GitHubRequesterFactory = defineFactory({
    name: 'GitHubRequesterFactory',
    deps: {
        browser: Browser,
        rateLimit: GitHubRateLimitStore,
    },
    setup({ browser, rateLimit }, getToken: () => string) {
        return createGitHubRequester({
            getToken,
            fetch: browser.fetch,
            onRateLimit: limit => rateLimit.update(limit),
        });
    },
});
