import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRateLimit } from '../GitHubRateLimit.js';
import { createGitHubRestRequester } from './createGitHubRestRequester.js';
import { readJobLog } from './readJobLog.js';

const PARAMS = { nameWithOwner: 'kedrzu/githq', jobId: 125_492_293_728 };

test('reads the log as the text it is, whatever it looks like', async () => {
    const requests: Parameters<Fetch>[] = [];
    const text = '\uFEFF2026-11-02T19:14:19.6484923Z Current runner version\n';
    const rest = restAnswering(new Response(text), requests);

    expect(await readJobLog(rest, PARAMS)).toMatchObject({ status: 200 });
    expect(requests[0]?.[0]).toBe('https://api.github.com/repos/kedrzu/githq/actions/jobs/125492293728/logs');

    const log = await readJobLog(restAnswering(new Response('{"a": 1}')), PARAMS);
    expect(log).toEqual({ status: 200, text: '{"a": 1}' });
});

test('the log stays out of the browser’s HTTP cache: a private repository’s would outlive signing out', async () => {
    const requests: Parameters<Fetch>[] = [];

    await readJobLog(restAnswering(new Response('log'), requests), PARAMS);

    expect(requests[0]?.[1]?.cache).toBe('no-store');
});

test('a request that asks nothing of the cache leaves it to the browser', async () => {
    const requests: Parameters<Fetch>[] = [];

    await restAnswering(Response.json({}), requests)({ url: '/rate_limit' });

    expect(requests[0]?.[1]?.cache).toBeUndefined();
});

test.each([404, 410])('a log past retention, answered %d, is gone: a result, not a failure', async status => {
    const rest = restAnswering(Response.json({ message: 'Gone' }, { status }));

    expect(await readJobLog(rest, PARAMS)).toEqual({ status: 'gone' });
});

test.each([401, 403, 500, 502])('any other refusal, %d, throws so the caller can offer a retry', async status => {
    const rest = restAnswering(Response.json({ message: 'No' }, { status }));

    const error: unknown = await readJobLog(rest, PARAMS).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({ status });
});

test('an answer that is not the log throws', async () => {
    const rest = restAnswering(new Response(null, { status: 204 }));

    await expect(readJobLog(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
});

test('a refusal still reports the allowance', async () => {
    const reported: GitHubRateLimit[] = [];
    const fetch: Fetch = () =>
        Promise.resolve(
            Response.json(
                { message: 'API rate limit exceeded' },
                {
                    status: 403,
                    headers: {
                        'x-ratelimit-resource': 'core',
                        'x-ratelimit-limit': '5000',
                        'x-ratelimit-remaining': '0',
                        'x-ratelimit-reset': '1798000000',
                    },
                },
            ),
        );
    const rest = createGitHubRestRequester({
        getToken: () => 'gho_token',
        fetch,
        onRateLimit: limit => reported.push(limit),
    });

    await expect(readJobLog(rest, PARAMS)).rejects.toBeInstanceOf(GitHubApiError);
    expect(reported).toEqual([{ resource: 'core', limit: 5000, remaining: 0, resetAt: new Date(1_798_000_000_000) }]);
});

function restAnswering(response: Response, requests: Parameters<Fetch>[] = []) {
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(response);
    };

    return createGitHubRestRequester({ getToken: () => 'gho_token', fetch });
}
