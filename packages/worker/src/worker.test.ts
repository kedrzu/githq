import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Mock } from 'bun:test';

import {
    OAUTH_APPROVAL_PATH,
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_SCOPES,
    OAUTH_TOKEN_PATH,
} from '@githq/github/oauth.js';
import type { OAuthErrorBody, OAuthTokenExchangeResult } from '@githq/github/oauth.js';

import worker from './worker.js';
import type { WorkerEnv } from './WorkerEnv.js';

// GitHub is the system boundary: its token endpoint is a stubbed global `fetch`. Every console call and
// every answer the Worker gives is captured, so each test also proves that the client secret never leaves
// the Worker and that no code or token ever reaches a log.

const ORIGIN = 'https://githq.test';
const CALLBACK = `${ORIGIN}${OAUTH_CALLBACK_PATH}`;
const STATE = 'q3V9-x_2LmZtR8wKpY4sNa';
const CODE = 'c0de4f1e2d3c4b5a6978';
const TOKEN = 'gho_TheAccessToken0123456789';
const ENV: WorkerEnv = {
    ASSETS: { fetch: () => Promise.resolve(new Response('asset')) },
    GITHUB_CLIENT_ID: 'Iv1.client-id',
    GITHUB_CLIENT_SECRET: 'the-client-secret-value',
};

let github: Mock<typeof fetch>;
let logged: string[];
let answered: string[];

beforeEach(() => {
    github = spyOn(globalThis, 'fetch');
    logged = [];
    answered = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
        spyOn(console, level).mockImplementation(captureLog);
    }
});

afterEach(() => {
    mock.restore();
    for (const answer of answered) {
        expect(answer).not.toContain(ENV.GITHUB_CLIENT_SECRET);
    }
    for (const line of logged) {
        expect(line).not.toContain(ENV.GITHUB_CLIENT_SECRET);
        expect(line).not.toContain(CODE);
        expect(line).not.toContain(TOKEN);
    }
});

function captureLog(...args: unknown[]) {
    logged.push(args.map(String).join(' '));
}

function githubAnswers(body: string, init?: ResponseInit) {
    github.mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json' }, ...init }));
}

function tokenRequest(body: unknown, init?: RequestInit) {
    return new Request(`${ORIGIN}${OAUTH_TOKEN_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        ...init,
    });
}

/** The Worker's answer, recorded whole (headers and body) for the checks in `afterEach`. */
async function call(request: Request, env: WorkerEnv = ENV) {
    const response = await worker.fetch(request, env);
    const headers = [...response.headers].map(([name, value]) => `${name}: ${value}`).join('\n');
    answered.push(`${headers}\n${await response.clone().text()}`);
    return response;
}

describe('GET /api/auth/authorize', () => {
    test('redirects to GitHub with the client ID, this origin’s callback, the scopes and the state', async () => {
        const response = await call(new Request(`${ORIGIN}${OAUTH_AUTHORIZE_PATH}?state=${STATE}`));

        expect(response.status).toBe(302);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const location = new URL(response.headers.get('location') ?? '');
        expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
        expect(Object.fromEntries(location.searchParams)).toEqual({
            client_id: 'Iv1.client-id',
            redirect_uri: CALLBACK,
            scope: OAUTH_SCOPES.join(' '),
            state: STATE,
        });
    });

    test('rejects a missing, short, long or odd state', async () => {
        for (const query of ['', '?state=', '?state=short', `?state=${'a'.repeat(129)}`, `?state=${STATE}%20x`]) {
            const response = await call(new Request(`${ORIGIN}${OAUTH_AUTHORIZE_PATH}${query}`));

            expect({ query, status: response.status }).toEqual({ query, status: 400 });
            expect(response.headers.get('location')).toBeNull();
            expect(await response.json()).toMatchObject({ error: 'invalid_state' } satisfies OAuthErrorBody);
        }
    });
});

test('GET /api/auth/approval redirects to GitHub’s page of the OAuth App, where an organisation’s approval is requested', async () => {
    const response = await call(new Request(`${ORIGIN}${OAUTH_APPROVAL_PATH}`));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://github.com/settings/connections/applications/Iv1.client-id');
    expect((await call(new Request(`${ORIGIN}${OAUTH_APPROVAL_PATH}`), { ASSETS: ENV.ASSETS })).status).toBe(500);
    expect(github).not.toHaveBeenCalled();
});

describe('POST /api/auth/token', () => {
    test('trades the code for a token and the scopes GitHub granted', async () => {
        githubAnswers(JSON.stringify({ access_token: TOKEN, token_type: 'bearer', scope: 'project,read:org,repo' }));

        const response = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }));

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            accessToken: TOKEN,
            scopes: ['project', 'read:org', 'repo'],
        } satisfies OAuthTokenExchangeResult);

        expect(github).toHaveBeenCalledTimes(1);
        const [url, init] = github.mock.calls[0] ?? [];
        expect(url).toBe('https://github.com/login/oauth/access_token');
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('accept')).toBe('application/json');
        const body = init?.body;
        expect(Object.fromEntries(body instanceof URLSearchParams ? body : [])).toEqual({
            client_id: 'Iv1.client-id',
            client_secret: 'the-client-secret-value',
            code: CODE,
            redirect_uri: CALLBACK,
        });
    });

    test('turns GitHub’s 200 error answer into a 400, never a token', async () => {
        githubAnswers(
            JSON.stringify({
                error: 'bad_verification_code',
                error_description: 'The code passed is incorrect or expired.',
            }),
        );

        const response = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'bad_verification_code',
            description: 'The code passed is incorrect or expired.',
        } satisfies OAuthErrorBody);
    });

    test('answers 502 when GitHub is unreachable or answers garbage', async () => {
        const failures: (() => void)[] = [
            () => github.mockRejectedValue(new TypeError('fetch failed')),
            () => githubAnswers('<html>Unicorn!</html>', { status: 503, headers: { 'content-type': 'text/html' } }),
            () => githubAnswers('not json'),
            () => githubAnswers('[]'),
            () => githubAnswers(JSON.stringify({ token_type: 'bearer', scope: 'repo' })),
        ];

        for (const [index, fail] of failures.entries()) {
            fail();
            const response = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }));

            expect({ index, status: response.status }).toEqual({ index, status: 502 });
            expect(await response.json()).not.toHaveProperty('accessToken');
        }
    });

    test('exchanges a code only for this origin’s callback', async () => {
        for (const redirectUri of [
            undefined,
            'https://evil.test/auth/callback',
            `${ORIGIN}/auth/callback/../../evil`,
            `${ORIGIN}/other`,
            `http://githq.test/auth/callback`,
            `${CALLBACK}?next=https://evil.test`,
        ]) {
            const response = await call(tokenRequest({ code: CODE, redirectUri }));

            expect({ redirectUri, status: response.status }).toEqual({ redirectUri, status: 400 });
            expect(await response.json()).toMatchObject({ error: 'invalid_redirect_uri' } satisfies OAuthErrorBody);
        }
        expect(github).not.toHaveBeenCalled();
    });

    test('rejects anything but a JSON POST with a code', async () => {
        const requests: [Request, number][] = [
            [new Request(`${ORIGIN}${OAUTH_TOKEN_PATH}?code=${CODE}`), 405],
            [tokenRequest({ code: CODE, redirectUri: CALLBACK }, { headers: { 'content-type': 'text/plain' } }), 415],
            [
                new Request(`${ORIGIN}${OAUTH_TOKEN_PATH}`, {
                    method: 'POST',
                    body: new URLSearchParams({ code: CODE, redirectUri: CALLBACK }),
                }),
                415,
            ],
            [tokenRequest({ redirectUri: CALLBACK }), 400],
            [tokenRequest({ code: 42, redirectUri: CALLBACK }), 400],
            [tokenRequest(null), 400],
            [tokenRequest(undefined, { body: '{"code":' }), 400],
        ];

        for (const [request, status] of requests) {
            const response = await call(request);

            expect(response.status).toBe(status);
            expect(response.headers.get('cache-control')).toBe('no-store');
        }
        expect(github).not.toHaveBeenCalled();
    });
});

test('without the OAuth App’s credentials both endpoints answer 500 not_configured', async () => {
    for (const env of [
        { ASSETS: ENV.ASSETS },
        { ASSETS: ENV.ASSETS, GITHUB_CLIENT_ID: 'Iv1.client-id' },
        { ASSETS: ENV.ASSETS, GITHUB_CLIENT_SECRET: 'x', GITHUB_CLIENT_ID: '' },
    ]) {
        for (const request of [
            new Request(`${ORIGIN}${OAUTH_AUTHORIZE_PATH}?state=${STATE}`),
            tokenRequest({ code: CODE, redirectUri: CALLBACK }),
        ]) {
            const response = await call(request, env);

            expect(response.status).toBe(500);
            expect(await response.json()).toMatchObject({ error: 'not_configured' } satisfies OAuthErrorBody);
        }
    }
    expect(github).not.toHaveBeenCalled();
});

test('answers an unknown API path with a JSON 404', async () => {
    const response = await call(new Request(`${ORIGIN}/api/nope`));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' } satisfies OAuthErrorBody);
});

describe('the landing page and the app at /', () => {
    // The assets answer by path, as the real ones do: `/` is the shell, `/_landing` the landing.
    const env: WorkerEnv = {
        ...ENV,
        ASSETS: {
            fetch: request =>
                Promise.resolve(new Response(new URL(request.url).pathname === '/' ? 'shell' : 'landing')),
        },
    };

    test('routes / by the signed-in cookie', async () => {
        expect(await (await call(new Request(`${ORIGIN}/?utm_source=x`), env)).text()).toBe('landing');
        const signedIn = new Request(`${ORIGIN}/`, { headers: { cookie: 'githq_signed_in=1' } });
        expect(await (await call(signedIn, env)).text()).toBe('shell');
    });

    test('never answers the landing at /_landing', async () => {
        expect(await (await call(new Request(`${ORIGIN}/_landing`), env)).text()).toBe('shell');
    });
});
