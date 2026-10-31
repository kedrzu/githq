import type { Fetch } from '@nzyme/types/Fetch.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { getSdk, ViewerDocument } from './generated.gen.js';
import type { ViewerQuery } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import type { GitHubGraphQLErrorEntry } from './GitHubApiError.js';

test('posts the operation with the bearer token and returns its data', async () => {
    const viewer: ViewerQuery = {
        viewer: { login: 'octocat', name: 'The Octocat', avatarUrl: 'https://avatars.example/octocat' },
    };
    const requests: Parameters<Fetch>[] = [];
    const fetch: Fetch = (...request) => {
        requests.push(request);
        return Promise.resolve(Response.json({ data: viewer }));
    };
    const sdk = getSdk(createGitHubRequester({ getToken: () => Promise.resolve('gho_token'), fetch }));

    expect(await sdk.Viewer()).toEqual(viewer);

    expect(requests).toHaveLength(1);
    const [input, init] = requests[0] ?? [];
    expect(input).toBe('https://api.github.com/graphql');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer gho_token');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
        query: ViewerDocument.toString(),
        variables: {},
    });
});

test('throws the GraphQL errors with their types, even next to partial data', async () => {
    const sdk = sdkAnswering(
        Response.json({
            data: { viewer: null },
            errors: [
                {
                    type: 'INSUFFICIENT_SCOPES',
                    path: ['viewer', 'projectsV2'],
                    message: "Your token has not been granted the required scopes. The 'project' scope is required.",
                },
                { type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve to a Repository.' },
            ],
        }),
    );

    const error = await catchError(sdk.Viewer());

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({
        status: 200,
        errors: [
            {
                type: 'INSUFFICIENT_SCOPES',
                path: ['viewer', 'projectsV2'],
                message: "Your token has not been granted the required scopes. The 'project' scope is required.",
            },
            { type: 'NOT_FOUND', path: ['repository'], message: 'Could not resolve to a Repository.' },
        ],
    });
});

test('a read taking partial answers gets the data, with the errors pointing into it, instead of a throw', async () => {
    const errors: GitHubGraphQLErrorEntry[] = [];
    const notFound: GitHubGraphQLErrorEntry = {
        type: 'NOT_FOUND',
        path: ['nodes', 1],
        message: "Could not resolve to a node with the global id of 'I_gone'",
    };
    const sdk = sdkAnswering(Response.json({ data: { nodes: [null, null] }, errors: [notFound] }));

    const data = await sdk.ItemsByIds({ ids: ['I_1', 'I_gone'] }, { onPartialErrors: found => errors.push(...found) });

    expect(data).toEqual({ nodes: [null, null] });
    expect(errors).toEqual([notFound]);
});

test('a partial answer still throws for an error without a path, and for a mutation', async () => {
    const onPartialErrors = () => {};
    const withoutPath = sdkAnswering(
        Response.json({ data: { nodes: [] }, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }),
    );
    await expect(withoutPath.ItemsByIds({ ids: [] }, { onPartialErrors })).rejects.toBeInstanceOf(GitHubApiError);

    const mutation = sdkAnswering(
        Response.json({
            data: { closeIssue: null },
            errors: [{ type: 'FORBIDDEN', path: ['closeIssue'], message: 'Resource not accessible' }],
        }),
    );
    await expect(
        mutation.CloseIssue({ issueId: 'I_1', stateReason: 'COMPLETED' }, { onPartialErrors }),
    ).rejects.toMatchObject({ errors: [{ type: 'FORBIDDEN' }] });
});

test('carries retry-after of a rate limit GitHub reports in the errors array', async () => {
    const sdk = sdkAnswering(
        Response.json(
            { errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded for user.' }] },
            { headers: { 'retry-after': '120' } },
        ),
    );

    await expect(sdk.Viewer()).rejects.toMatchObject({
        status: 200,
        retryAfter: 120,
        errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded for user.' }],
    });
});

function sdkAnswering(response: Response) {
    return getSdk(createGitHubRequester({ getToken: () => 'gho_token', fetch: () => Promise.resolve(response) }));
}

async function catchError(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return error;
    }

    throw new Error('Expected the request to fail');
}
