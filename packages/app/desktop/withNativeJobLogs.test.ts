import { expect, test } from 'bun:test';

import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import { createGitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { readJobLog } from '@githq/github/rest/readJobLog.js';

import { JobLogRefusal } from '@/workflows/utils/JobLogRefusal.js';

import type { JobLogAnswer, ReadJobLogParams } from './NativeBridge.js';
import { withNativeJobLogs } from './withNativeJobLogs.js';

const JOB = { nameWithOwner: 'acme/web', jobId: 125_492_293_728 };
const ALLOWANCE = {
    'x-ratelimit-resource': 'core',
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '1790000000',
};

test('a job log is asked of the native side, with the token, and never of the window', async () => {
    const { rest, reads, windowFetches } = setup({ status: 200, headers: {}, text: 'the log' });

    expect(await readJobLog(rest, JOB)).toEqual({ status: 200, text: 'the log' });

    expect(reads).toEqual([{ owner: 'acme', name: 'web', jobId: 125_492_293_728, token: 'gho_secret' }]);
    expect(windowFetches).toEqual([]);
});

test('anything else goes through the window, untouched', async () => {
    const { rest, reads, windowFetches } = setup({ status: 200, headers: {}, text: 'the log' });

    for (const url of [
        '/repos/acme/web/actions/runs/7',
        '/repos/acme/web/actions/jobs/70',
        '/repos/acme/web/actions/jobs/abc/logs',
        '/repos/acme/web/actions/jobs/70/logs/more',
        'https://example.com/repos/acme/web/actions/jobs/70/logs',
    ]) {
        await rest({ url });
    }
    await rest({ url: '/repos/acme/web/actions/jobs/70/logs', query: { page: '2' } });

    expect(reads).toEqual([]);
    expect(windowFetches).toHaveLength(6);
});

test.each([404, 410])('a log answering %d is gone', async status => {
    const { rest } = setup({ status, headers: ALLOWANCE, text: '{"message":"Not Found"}' });

    expect(await readJobLog(rest, JOB)).toEqual({ status: 'gone' });
});

test('any other refusal keeps its status, GitHub’s words and when to try again', async () => {
    const { rest } = setup({ status: 502, headers: { 'retry-after': '60' }, text: '{"message":"Bad gateway"}' });

    const error: unknown = await readJobLog(rest, JOB).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({ status: 502, retryAfter: 60, githubMessage: 'Bad gateway' });
});

test('a refusal’s allowance reaches whoever keeps it, as on the web', async () => {
    const { rest, allowances } = setup({ status: 403, headers: ALLOWANCE, text: '{"message":"Rate limited"}' });

    await readJobLog(rest, JOB).catch(() => {});

    expect(allowances).toEqual([{ resource: 'core', limit: 5000, remaining: 0, resetAt: new Date(1_790_000_000_000) }]);
});

test('the native side unable to reach GitHub is a failure with no status to tell', async () => {
    const { rest } = setup('offline');

    const error: unknown = await readJobLog(rest, JOB).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(GitHubApiError);
    expect(error).toBe('offline');
});

test.each([
    ['tooLarge', 'tooLarge'],
    ['refused', 'refused'],
    ['invalid', 'refused'],
    ['failed', 'refused'],
])('the native side’s %s is the app refusing the log: %s, GitHub having no part in it', async (code, reason) => {
    const { rest } = setup(code);

    const error: unknown = await readJobLog(rest, JOB).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(JobLogRefusal);
    expect(error).toMatchObject({ reason });
});

/** The requester the app builds, over the desktop's browser, with the native side answering `answer` or failing with it. */
function setup(answer: JobLogAnswer | string) {
    const reads: ReadJobLogParams[] = [];
    const windowFetches: unknown[] = [];
    const allowances: GitHubRateLimit[] = [];
    const browser = withNativeJobLogs(
        {
            fetch: input => {
                windowFetches.push(input);
                return Promise.resolve(Response.json({}));
            },
        },
        {
            readJobLog: async params => {
                reads.push(params);
                if (typeof answer === 'string') {
                    // A command that fails rejects with its error code, a bare string, as Tauri's do.
                    const failed = Promise.withResolvers<JobLogAnswer>();
                    failed.reject(answer);
                    return await failed.promise;
                }

                return answer;
            },
        },
    );
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_secret',
        fetch: browser.fetch,
        onRateLimit: limit => allowances.push(limit),
    });

    return { rest, reads, windowFetches, allowances };
}
