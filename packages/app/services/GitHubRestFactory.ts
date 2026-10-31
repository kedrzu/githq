import { createGitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { defineFactory } from '@nzyme/ioc/Factory.js';

import { Browser } from './Browser.js';
import { GitHubRateLimitStore } from './GitHubRateLimitStore.js';

/**
 * The GitHub REST requester for one token (`searchIssues(factory(() => token), …)`), the REST twin of
 * `GitHubSdkFactory`: every answer's allowance goes to {@link GitHubRateLimitStore}.
 */
export const GitHubRestFactory = defineFactory({
    name: 'GitHubRestFactory',
    deps: {
        browser: Browser,
        rateLimit: GitHubRateLimitStore,
    },
    setup({ browser, rateLimit }, getToken: () => string) {
        return createGitHubRestRequester({
            getToken,
            fetch: browser.fetch,
            onRateLimit: limit => rateLimit.update(limit),
        });
    },
});
