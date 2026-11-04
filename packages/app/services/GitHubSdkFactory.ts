import { getSdk } from '@githq/github/generated.gen.js';
import { defineFactory } from '@nzyme/ioc/Factory.js';

import { GitHubRequesterFactory } from './GitHubRequesterFactory.js';

/**
 * The typed GitHub GraphQL SDK for one token: `factory(() => token).Viewer()`. Sends through
 * {@link GitHubRequesterFactory}. Takes the token as a getter, so an SDK made once follows a token that
 * changes.
 */
export const GitHubSdkFactory = defineFactory({
    name: 'GitHubSdkFactory',
    deps: {
        createRequester: GitHubRequesterFactory,
    },
    setup({ createRequester }, getToken: () => string) {
        return getSdk(createRequester(getToken));
    },
});
