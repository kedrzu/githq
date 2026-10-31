import { test as base } from '@playwright/test';

import { GitHubMock } from './github/GitHubMock.js';

export interface E2eFixtures {
    /**
     * GitHub, as this test answers it: every request of the test's browser to a GitHub host goes to it. Set
     * up in every test, used or not; a request it was not told to answer fails the test when it ends.
     */
    github: GitHubMock;
}

/** The e2e `test`: a browser that never reaches GitHub ({@link GitHubMock}). */
export const test = base.extend<E2eFixtures>({
    github: [
        async ({ context }, use) => {
            const github = new GitHubMock();
            await github.install(context);
            await use(github);
            github.assertAllRouted();
        },
        { auto: true },
    ],
});

export { expect } from '@playwright/test';
