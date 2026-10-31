import { HttpError } from '@nzyme/fetch-utils/HttpError.js';
import type { Fetch } from '@nzyme/types/Fetch.js';
import { describe, expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import type { GitHubRateLimit } from './GitHubRateLimit.js';
import { createGitHubRestRequester } from './rest/createGitHubRestRequester.js';
import type { GitHubRequesterOptions } from './sendGitHubRequest.js';

// The GraphQL and the REST requester must fail and report rate limits the same way, so the scheduler handles
// both with one code path: every case runs through each.
const REQUESTERS = [
    {
        api: 'GraphQL',
        call: (options: GitHubRequesterOptions) => getSdk(createGitHubRequester(options)).Viewer(),
        success: () => ({ data: { viewer: { login: 'octocat', name: null, avatarUrl: 'https://avatars.example/o' } } }),
    },
    {
        api: 'REST',
        call: (options: GitHubRequesterOptions) => createGitHubRestRequester(options)({ url: '/user' }),
        success: () => ({ login: 'octocat' }),
    },
];

describe.each(REQUESTERS)('$api', ({ call, success }) => {
    test('throws the HTTP status of a rejected token as an HttpError', async () => {
        const answer = Response.json({ message: 'Bad credentials' }, { status: 401 });

        const error = await catchError(call(answering([answer])));

        expect(error).toBeInstanceOf(GitHubApiError);
        expect(error).toBeInstanceOf(HttpError);
        expect(error).toMatchObject({
            status: 401,
            errors: [],
            retryAfter: undefined,
            message: 'GitHub request failed: 401 Bad credentials',
        });
    });

    test.each([403, 429])('carries retry-after of a secondary rate limit answered %d', async status => {
        const answer = Response.json(
            { message: 'You have exceeded a secondary rate limit.' },
            { status, headers: { 'retry-after': '60' } },
        );

        const error = await catchError(call(answering([answer])));

        expect(error).toBeInstanceOf(GitHubApiError);
        expect(error).toMatchObject({ status, retryAfter: 60 });
    });

    test('reports the rate-limit bucket of every answer, failed ones too', async () => {
        const reported: GitHubRateLimit[] = [];
        const answers = [
            Response.json(success(), { headers: rateLimitHeaders('graphql', '4999', '1798000000') }),
            Response.json(
                { message: 'API rate limit exceeded' },
                { status: 403, headers: rateLimitHeaders('search', '0', '1798003600') },
            ),
            // No rate-limit headers: nothing to report.
            Response.json(success()),
        ];
        const options: GitHubRequesterOptions = {
            ...answering(answers),
            onRateLimit: rateLimit => reported.push(rateLimit),
        };

        await call(options);
        // A primary limit has no retry-after: its reset time is in the report.
        expect(await catchError(call(options))).toMatchObject({ status: 403, retryAfter: undefined });
        await call(options);

        expect(reported).toEqual([
            { resource: 'graphql', limit: 5000, remaining: 4999, resetAt: new Date(1_798_000_000_000) },
            { resource: 'search', limit: 5000, remaining: 0, resetAt: new Date(1_798_003_600_000) },
        ]);
    });
});

function answering(answers: Response[]): GitHubRequesterOptions {
    const fetch: Fetch = () => {
        const answer = answers.shift();
        return answer ? Promise.resolve(answer) : Promise.reject(new Error('No answer left'));
    };

    return { getToken: () => 'gho_token', fetch };
}

async function catchError(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return error;
    }

    throw new Error('Expected the request to fail');
}

function rateLimitHeaders(resource: string, remaining: string, reset: string) {
    return {
        'x-ratelimit-resource': resource,
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': remaining,
        'x-ratelimit-reset': reset,
    };
}
