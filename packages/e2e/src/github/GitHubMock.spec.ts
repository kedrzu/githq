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
    await page.goto('/');

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
    await page.goto('/');

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
    await page.goto('/');

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

test('the GitHub world answers a run, its jobs and a job’s log; an id it does not know is 404, and a log can fail', async ({
    browser,
}) => {
    const context = await browser.newContext({ baseURL: E2E_BASE_URL });
    const github = new GitHubMock();
    await github.install(context);
    const world = new GitHubWorld('octocat');
    world.repository('acme/web.js');
    world.workflow({ repository: 'acme/web.js', name: 'Deploy' });
    const runId = world.workflowRun('acme/web.js', 'Deploy', { conclusion: 'failure', minutesAgo: 5 });
    const [jobId = 0, otherJobId = 0] = world.runJobs('acme/web.js', runId, [
        { name: 'test', conclusion: 'failure', steps: [{ name: 'Set up job', conclusion: 'success' }] },
        { name: 'deploy', conclusion: 'skipped' },
    ]);
    world.jobLog('acme/web.js', jobId, '\uFEFF2026-11-02T19:14:19.6484923Z ##[error]exit code 1\n');
    world.jobLog('acme/web.js', otherJobId, 410);
    world.install(github);
    const page = await context.newPage();
    await page.goto('/');

    const base = 'https://api.github.com/repos/acme/web.js/actions';
    const read = (path: string) =>
        page.evaluate(async url => {
            const response = await fetch(url);
            return { status: response.status, type: response.headers.get('content-type'), text: await response.text() };
        }, `${base}${path}`);

    const run = await read(`/runs/${runId}`);
    expect(run.status).toBe(200);
    expect(JSON.parse(run.text)).toMatchObject({ id: runId, name: 'Deploy', conclusion: 'failure' });

    const jobs = await read(`/runs/${runId}/jobs`);
    expect(JSON.parse(jobs.text)).toMatchObject({
        total_count: 2,
        jobs: [
            { id: jobId, name: 'test', steps: [{ name: 'Set up job', number: 1, conclusion: 'success' }] },
            { id: otherJobId, name: 'deploy', steps: [] },
        ],
    });

    expect(await read(`/jobs/${jobId}/logs`)).toMatchObject({
        status: 200,
        type: 'text/plain',
        text: '2026-11-02T19:14:19.6484923Z ##[error]exit code 1\n',
    });
    expect((await read(`/jobs/${otherJobId}/logs`)).status).toBe(410);
    for (const unknown of ['/runs/999', '/runs/999/jobs', '/jobs/999/logs']) {
        expect((await read(unknown)).status).toBe(404);
    }

    github.assertAllRouted();
    await context.close();
});
