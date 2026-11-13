import { OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import type { GitHubMock } from '../github/GitHubMock.js';
import { E2E_BASE_URL } from '../localApp.js';

/**
 * Answers GitHub's consent screen (`github.com/login/oauth/authorize`) by sending the browser back to the
 * app's callback with `callbackQuery` (given the `state` GitHub was sent); resolves with the screen's address.
 */
export function answerAuthorize(github: GitHubMock, callbackQuery: (state: string) => Record<string, string>) {
    const opened = createPromise<URL>();
    github.web('/login/oauth/authorize', url => {
        opened.resolve(url);
        const callback = new URL(OAUTH_CALLBACK_PATH, E2E_BASE_URL);
        callback.search = new URLSearchParams(callbackQuery(url.searchParams.get('state') ?? '')).toString();
        return { status: 302, headers: { location: callback.href } };
    });

    return opened.promise;
}
