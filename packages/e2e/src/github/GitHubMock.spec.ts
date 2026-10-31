import { expect, test } from '../fixtures.js';
import { E2E_BASE_URL } from '../localApp.js';

import { GitHubMock } from './GitHubMock.js';
import { GitHubWorld } from './GitHubWorld.js';

// The mock's own guarantee: a GitHub request no test answered never reaches GitHub, and fails the test. Run on a
// browser of its own with a mock of its own, so the failure can be looked at instead of failing this test.

test('a GitHub request the test did not mock never reaches GitHub, and fails the test naming it', async ({
    browser,
}) => {
    const context = await browser.newContext({ baseURL: E2E_BASE_URL });
    const github = new GitHubMock();
    await github.install(context);
    const page = await context.newPage();
    await page.goto('/sign-in');

    const outcomes = await page.evaluate(async () => {
        const requests = [
            fetch('https://api.github.com/graphql', {
                method: 'POST',
                body: JSON.stringify({ query: 'query Viewer { viewer { login } }' }),
            }),
            fetch('https://api.github.com/repos/octocat/hello-world/issues'),
            fetch('https://raw.githubusercontent.com/octocat/hello-world/main/README.md'),
        ];
        return await Promise.all(
            requests.map(request =>
                request.then(
                    () => 'answered',
                    () => 'failed',
                ),
            ),
        );
    });
    expect(outcomes).toEqual(['failed', 'failed', 'failed']);
    await expect(page.goto('https://github.com/login/oauth/authorize?client_id=e2e-client')).rejects.toThrow();

    expect(() => github.assertAllRouted()).toThrow(
        [
            'The app made GitHub requests the test did not mock (GitHubMock):',
            '- POST https://api.github.com/graphql — operation Viewer',
            '- GET https://api.github.com/repos/octocat/hello-world/issues',
            '- GET https://raw.githubusercontent.com/octocat/hello-world/main/README.md',
            '- GET https://github.com/login/oauth/authorize?client_id=e2e-client',
        ].join('\n'),
    );
    // Reported once: the next check is about what comes after.
    expect(() => github.assertAllRouted()).not.toThrow();

    await context.close();
});

test('the token exchange is never left to the Worker, which would ask GitHub', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: E2E_BASE_URL });
    const github = new GitHubMock();
    await github.install(context);
    const page = await context.newPage();
    await page.goto('/sign-in');

    const status = await page.evaluate(async () => {
        const response = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'e2e-code', redirectUri: `${location.origin}/auth/callback` }),
        }).catch(() => null);
        return response?.status ?? 'failed';
    });
    expect(status).toBe('failed');
    expect(() => github.assertAllRouted()).toThrow(`- POST ${E2E_BASE_URL}/api/auth/token`);

    await context.close();
});

test("the Worker's redirect to GitHub is answered by the mock, never followed to GitHub", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: E2E_BASE_URL });
    const github = new GitHubMock();
    await github.install(context);
    const page = await context.newPage();

    await expect(page.goto('/api/auth/authorize?state=e2eSelfTestStateValue')).rejects.toThrow();

    expect(page.url()).not.toContain('github.com');
    expect(() => github.assertAllRouted()).toThrow(
        /^The app made GitHub requests the test did not mock \(GitHubMock\):\n- GET https:\/\/github\.com\/login\/oauth\/authorize\?client_id=e2e-client&[^\n]*$/,
    );

    await context.close();
});

test('a search the GitHub world does not know is unrouted, naming its query', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: E2E_BASE_URL });
    const github = new GitHubMock();
    await github.install(context);
    new GitHubWorld('octocat').install(github);
    const page = await context.newPage();
    await page.goto('/sign-in');

    const outcomes = await page.evaluate(async () => {
        const queries = ['is:open is:pr author:@me archived:false', 'is:open is:pr author:@me'];
        return await Promise.all(
            queries.map(q =>
                fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}`).then(
                    response => response.status,
                    () => 'failed',
                ),
            ),
        );
    });
    expect(outcomes).toEqual([200, 'failed']);
    expect(() => github.assertAllRouted()).toThrow(
        '- GET https://api.github.com/search/issues?q=is%3Aopen%20is%3Apr%20author%3A%40me',
    );

    await context.close();
});
