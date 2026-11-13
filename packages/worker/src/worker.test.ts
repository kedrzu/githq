import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Mock } from 'bun:test';

import {
    OAUTH_APPROVAL_PATH,
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_REFRESH_PATH,
    OAUTH_REVOKE_PATH,
    OAUTH_SCOPES,
    OAUTH_TOKEN_PATH,
} from '@githq/github/oauth.js';
import type { OAuthErrorBody, OAuthTokenExchangeResult } from '@githq/github/oauth.js';

import worker from './worker.js';
import type { AnalyticsEngineDataPoint, WorkerEnv } from './WorkerEnv.js';

// GitHub is the system boundary: its token endpoint is a stubbed global `fetch`. Every console call and
// every answer the Worker gives is captured, so each test also proves that the client secret never leaves
// the Worker and that no code, token or refresh token ever reaches a log.

const ORIGIN = 'https://githq.test';
const CALLBACK = `${ORIGIN}${OAUTH_CALLBACK_PATH}`;
const STATE = 'q3V9-x_2LmZtR8wKpY4sNa';
const CODE = 'c0de4f1e2d3c4b5a6978';
const TOKEN = 'gho_TheAccessToken0123456789';
const REFRESH_TOKEN = 'ghr_TheRefreshToken0123456789';
const NEW_TOKEN = 'gho_TheRefreshedAccessToken0123';
const NEW_REFRESH_TOKEN = 'ghr_TheNewRefreshToken0123456789';
/** `e2e-client:the-client-secret-value`, as GitHub's Basic auth wants it. */
const CLIENT_BASIC_AUTH = `Basic ${btoa('e2e-client:the-client-secret-value')}`;
const ENV: WorkerEnv = {
    ASSETS: { fetch: () => Promise.resolve(new Response('asset')) },
    GITHQ_ENV: 'e2e',
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
        for (const token of [TOKEN, REFRESH_TOKEN, NEW_TOKEN, NEW_REFRESH_TOKEN]) {
            expect(line).not.toContain(token);
        }
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
            client_id: 'e2e-client',
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
    expect(response.headers.get('location')).toBe('https://github.com/settings/connections/applications/e2e-client');
    expect((await call(new Request(`${ORIGIN}${OAUTH_APPROVAL_PATH}`), { ASSETS: ENV.ASSETS })).status).toBe(500);
    expect(github).not.toHaveBeenCalled();
});

describe('POST /api/auth/token', () => {
    test('trades the code for a token, its refresh token and expiry, and the scopes GitHub granted', async () => {
        githubAnswers(
            JSON.stringify({
                access_token: TOKEN,
                expires_in: 28800,
                refresh_token: REFRESH_TOKEN,
                refresh_token_expires_in: 15811200,
                token_type: 'bearer',
                scope: 'project,read:org,repo',
            }),
        );

        const response = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }));

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            accessToken: TOKEN,
            refreshToken: REFRESH_TOKEN,
            expiresIn: 28800,
            scopes: ['project', 'read:org', 'repo'],
        } satisfies OAuthTokenExchangeResult);

        expect(github).toHaveBeenCalledTimes(1);
        const [url, init] = github.mock.calls[0] ?? [];
        expect(url).toBe('https://github.com/login/oauth/access_token');
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('accept')).toBe('application/json');
        const body = init?.body;
        expect(Object.fromEntries(body instanceof URLSearchParams ? body : [])).toEqual({
            client_id: 'e2e-client',
            client_secret: 'the-client-secret-value',
            code: CODE,
            redirect_uri: CALLBACK,
        });
    });

    test('answers no refresh token and no expiry for a token that never expires', async () => {
        githubAnswers(JSON.stringify({ access_token: TOKEN, token_type: 'bearer', scope: 'repo' }));

        const response = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }));

        expect(await response.json()).toEqual({
            accessToken: TOKEN,
            refreshToken: null,
            expiresIn: null,
            scopes: ['repo'],
        } satisfies OAuthTokenExchangeResult);
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

function refreshRequest(body: unknown, init?: RequestInit) {
    return new Request(`${ORIGIN}${OAUTH_REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'tauri://localhost' },
        body: JSON.stringify(body),
        ...init,
    });
}

describe('POST /api/auth/refresh', () => {
    test('trades the refresh token for new tokens with the OAuth App’s credentials, the token in the body only', async () => {
        githubAnswers(
            JSON.stringify({
                access_token: NEW_TOKEN,
                expires_in: 28800,
                refresh_token: NEW_REFRESH_TOKEN,
                refresh_token_expires_in: 15811200,
                token_type: 'bearer',
                scope: 'project,read:org,repo',
            }),
        );

        const response = await call(refreshRequest({ refreshToken: REFRESH_TOKEN }));

        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            accessToken: NEW_TOKEN,
            refreshToken: NEW_REFRESH_TOKEN,
            expiresIn: 28800,
            scopes: ['project', 'read:org', 'repo'],
        } satisfies OAuthTokenExchangeResult);

        expect(github).toHaveBeenCalledTimes(1);
        const [url, init] = github.mock.calls[0] ?? [];
        expect(url).toBe('https://github.com/login/oauth/access_token');
        expect(init?.method).toBe('POST');
        const body = init?.body;
        expect(Object.fromEntries(body instanceof URLSearchParams ? body : [])).toEqual({
            client_id: 'e2e-client',
            client_secret: 'the-client-secret-value',
            grant_type: 'refresh_token',
            refresh_token: REFRESH_TOKEN,
        });
    });

    test('answers a refresh token GitHub no longer accepts as bad_refresh_token, unlike GitHub being unreachable', async () => {
        githubAnswers(
            JSON.stringify({
                error: 'bad_refresh_token',
                error_description: 'The refresh token passed is incorrect or expired.',
            }),
        );

        const refused = await call(refreshRequest({ refreshToken: REFRESH_TOKEN }));

        expect(refused.status).toBe(400);
        expect(refused.headers.get('access-control-allow-origin')).toBe('*');
        expect(await refused.json()).toEqual({
            error: 'bad_refresh_token',
            description: 'The refresh token passed is incorrect or expired.',
        } satisfies OAuthErrorBody);

        github.mockRejectedValue(new TypeError('fetch failed'));

        const unreachable = await call(refreshRequest({ refreshToken: REFRESH_TOKEN }));

        expect(unreachable.status).toBe(502);
        expect(unreachable.headers.get('access-control-allow-origin')).toBe('*');
        expect(await unreachable.json()).toEqual({ error: 'github_unreachable' } satisfies OAuthErrorBody);
    });

    test('answers the desktop app’s CORS preflight', async () => {
        const response = await call(
            new Request(`${ORIGIN}${OAUTH_REFRESH_PATH}`, {
                method: 'OPTIONS',
                headers: {
                    origin: 'tauri://localhost',
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type',
                },
            }),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
        expect(github).not.toHaveBeenCalled();
    });

    test('refuses anything but a JSON POST of a refresh token, without asking GitHub', async () => {
        const requests: [Request, number][] = [
            [new Request(`${ORIGIN}${OAUTH_REFRESH_PATH}`), 405],
            [refreshRequest({ refreshToken: REFRESH_TOKEN }, { headers: { 'content-type': 'text/plain' } }), 415],
            [refreshRequest({}), 400],
            [refreshRequest({ refreshToken: '' }), 400],
            [refreshRequest({ refreshToken: TOKEN }), 400],
            [refreshRequest({ token: REFRESH_TOKEN }), 400],
            [refreshRequest({ refreshToken: `ghr_${'a'.repeat(252)}` }), 400],
            [refreshRequest({ refreshToken: 'ghr_with spaces' }), 400],
            [refreshRequest(undefined, { body: 'not json' }), 400],
        ];

        for (const [index, [request, status]] of requests.entries()) {
            const response = await call(request);

            expect({ index, status: response.status }).toEqual({ index, status });
            expect(response.headers.get('access-control-allow-origin')).toBe('*');
        }
        expect(github).not.toHaveBeenCalled();
    });
});

function revokeRequest(body: unknown, init?: RequestInit) {
    return new Request(`${ORIGIN}${OAUTH_REVOKE_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'tauri://localhost' },
        body: JSON.stringify(body),
        ...init,
    });
}

describe('POST /api/auth/revoke', () => {
    test('revokes the token at GitHub with the OAuth App’s credentials, the token in the body only', async () => {
        github.mockResolvedValue(new Response(null, { status: 204 }));

        const response = await call(revokeRequest({ token: TOKEN }));

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(github).toHaveBeenCalledTimes(1);
        const [url, init] = github.mock.calls[0] ?? [];
        expect(url).toBe('https://api.github.com/applications/e2e-client/token');
        expect(typeof url === 'string' ? url : '').not.toContain(TOKEN);
        expect(init?.method).toBe('DELETE');
        expect(new Headers(init?.headers).get('authorization')).toBe(CLIENT_BASIC_AUTH);
        expect(new Headers(init?.headers).get('user-agent')).not.toBeNull();
        expect(typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body).toEqual({ access_token: TOKEN });
    });

    test('revokes an expiring token as well, whose prefix may be ghu_', async () => {
        github.mockResolvedValue(new Response(null, { status: 204 }));

        const response = await call(revokeRequest({ token: 'ghu_AnExpiringAccessToken0123' }));

        expect(response.status).toBe(204);
        expect(github).toHaveBeenCalledTimes(1);
    });

    test('answers the same for a token GitHub no longer knows, so it tells no one whether a token is alive', async () => {
        github.mockResolvedValue(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));

        const response = await call(revokeRequest({ token: TOKEN }));

        expect(response.status).toBe(204);
    });

    test('answers 502 when GitHub refuses or cannot be reached', async () => {
        github.mockResolvedValueOnce(new Response('{"message":"Validation Failed"}', { status: 422 }));
        github.mockRejectedValueOnce(new TypeError('network down'));

        for (const error of ['github_bad_response', 'github_unreachable']) {
            const response = await call(revokeRequest({ token: TOKEN }));

            expect(response.status).toBe(502);
            expect(response.headers.get('access-control-allow-origin')).toBe('*');
            expect(await response.json()).toMatchObject({ error } satisfies OAuthErrorBody);
        }
    });

    test('answers the desktop app’s CORS preflight', async () => {
        const response = await call(
            new Request(`${ORIGIN}${OAUTH_REVOKE_PATH}`, {
                method: 'OPTIONS',
                headers: {
                    origin: 'tauri://localhost',
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type',
                },
            }),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
        expect(github).not.toHaveBeenCalled();
    });

    test('refuses anything but a JSON POST of an OAuth App token, without asking GitHub', async () => {
        const requests = [
            new Request(`${ORIGIN}${OAUTH_REVOKE_PATH}`),
            revokeRequest({ token: TOKEN }, { headers: { 'content-type': 'text/plain' } }),
            revokeRequest({}),
            revokeRequest({ token: '' }),
            revokeRequest({ token: 'ghp_APersonalAccessToken0123' }),
            revokeRequest({ token: `gho_${'a'.repeat(252)}` }),
            revokeRequest({ token: 'gho_with spaces' }),
            new Request(`${ORIGIN}${OAUTH_REVOKE_PATH}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: 'not json',
            }),
        ];

        for (const request of requests) {
            const response = await call(request);

            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.status).toBeLessThan(500);
        }
        expect(github).not.toHaveBeenCalled();
    });
});

test('the token exchange answers no CORS, unlike the revocation', async () => {
    const response = await call(
        new Request(`${ORIGIN}${OAUTH_TOKEN_PATH}`, {
            method: 'OPTIONS',
            headers: { origin: 'https://evil.test', 'access-control-request-method': 'POST' },
        }),
    );

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

test('without the OAuth App’s credentials the auth endpoints answer 500 not_configured', async () => {
    for (const env of [
        { ASSETS: ENV.ASSETS },
        { ASSETS: ENV.ASSETS, GITHQ_ENV: 'e2e' },
        { ASSETS: ENV.ASSETS, GITHUB_CLIENT_SECRET: 'x', GITHQ_ENV: 'unknown' },
    ]) {
        for (const request of [
            new Request(`${ORIGIN}${OAUTH_AUTHORIZE_PATH}?state=${STATE}`),
            tokenRequest({ code: CODE, redirectUri: CALLBACK }),
            refreshRequest({ refreshToken: REFRESH_TOKEN }),
            revokeRequest({ token: TOKEN }),
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

describe('usage statistics', () => {
    // Headers a data point must never carry: the visitor's IP, browser and country.
    const VISITOR_HEADERS = {
        'cf-connecting-ip': '203.0.113.7',
        'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605',
        'cf-ipcountry': 'PL',
    };

    test('counts a created token from the web app, with nothing but the event and the client', async () => {
        const usage = usageBinding();
        githubAnswers(JSON.stringify({ access_token: TOKEN, scope: 'repo' }));

        await call(
            tokenRequest(
                { code: CODE, redirectUri: CALLBACK },
                { headers: { 'content-type': 'application/json', ...VISITOR_HEADERS } },
            ),
            { ...ENV, USAGE: usage.binding },
        );

        const expected: AnalyticsEngineDataPoint[] = [
            { blobs: ['token_created', 'web', ''], doubles: [1], indexes: ['token_created'] },
        ];
        expect(usage.points).toEqual(expected);
    });

    test('counts a revoked token from the desktop app, but not one GitHub no longer knew', async () => {
        const usage = usageBinding();
        github.mockResolvedValueOnce(new Response(null, { status: 204 }));
        github.mockResolvedValueOnce(new Response('{"message":"Not Found"}', { status: 404 }));

        for (let i = 0; i < 2; i++) {
            await call(
                revokeRequest(
                    { token: TOKEN },
                    {
                        headers: {
                            'content-type': 'application/json',
                            origin: 'tauri://localhost',
                            ...VISITOR_HEADERS,
                        },
                    },
                ),
                { ...ENV, USAGE: usage.binding },
            );
        }

        const point: AnalyticsEngineDataPoint = {
            blobs: ['token_revoked', 'desktop', ''],
            doubles: [1],
            indexes: ['token_revoked'],
        };
        expect(usage.points).toEqual([point]);
    });

    test('counts a refreshed token, from the web app and from the desktop app', async () => {
        const usage = usageBinding();
        const env = { ...ENV, USAGE: usage.binding };
        const renewed = JSON.stringify({ access_token: NEW_TOKEN, refresh_token: NEW_REFRESH_TOKEN, scope: 'repo' });

        githubAnswers(renewed);
        await call(
            refreshRequest(
                { refreshToken: REFRESH_TOKEN },
                { headers: { 'content-type': 'application/json', ...VISITOR_HEADERS } },
            ),
            env,
        );
        githubAnswers(renewed);
        await call(
            refreshRequest(
                { refreshToken: REFRESH_TOKEN },
                { headers: { 'content-type': 'application/json', origin: 'tauri://localhost', ...VISITOR_HEADERS } },
            ),
            env,
        );

        const expected: AnalyticsEngineDataPoint[] = [
            { blobs: ['token_refreshed', 'web', ''], doubles: [1], indexes: ['token_refreshed'] },
            { blobs: ['token_refreshed', 'desktop', ''], doubles: [1], indexes: ['token_refreshed'] },
        ];
        expect(usage.points).toEqual(expected);
    });

    test('counts nothing when the body turns statistics off', async () => {
        const usage = usageBinding();
        githubAnswers(JSON.stringify({ access_token: TOKEN, scope: 'repo' }));
        const env = { ...ENV, USAGE: usage.binding };

        const exchanged = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK, telemetry: false }), env);
        github.mockResolvedValue(new Response(null, { status: 204 }));
        const revoked = await call(revokeRequest({ token: TOKEN, telemetry: false }), env);
        githubAnswers(JSON.stringify({ access_token: NEW_TOKEN, refresh_token: NEW_REFRESH_TOKEN, scope: 'repo' }));
        const refreshed = await call(refreshRequest({ refreshToken: REFRESH_TOKEN, telemetry: false }), env);

        expect([exchanged.status, revoked.status, refreshed.status]).toEqual([200, 204, 200]);
        expect(usage.points).toEqual([]);
    });

    test('counts no refused or failed exchange, revocation or refresh', async () => {
        const usage = usageBinding();
        const env = { ...ENV, USAGE: usage.binding };

        githubAnswers(JSON.stringify({ error: 'bad_verification_code' }));
        await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }), env);
        github.mockRejectedValueOnce(new TypeError('fetch failed'));
        await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }), env);
        await call(tokenRequest({ code: CODE, redirectUri: 'https://evil.test/auth/callback' }), env);
        github.mockResolvedValueOnce(new Response('{"message":"Validation Failed"}', { status: 422 }));
        await call(revokeRequest({ token: TOKEN }), env);
        github.mockRejectedValueOnce(new TypeError('network down'));
        await call(revokeRequest({ token: TOKEN }), env);
        await call(revokeRequest({ token: 'ghp_APersonalAccessToken0123' }), env);
        await call(new Request(`${ORIGIN}${OAUTH_REVOKE_PATH}`, { method: 'OPTIONS' }), env);
        await call(revokeRequest({ token: TOKEN }), { ASSETS: ENV.ASSETS, USAGE: usage.binding });
        githubAnswers(JSON.stringify({ error: 'bad_refresh_token' }));
        await call(refreshRequest({ refreshToken: REFRESH_TOKEN }), env);
        github.mockRejectedValueOnce(new TypeError('fetch failed'));
        await call(refreshRequest({ refreshToken: REFRESH_TOKEN }), env);
        await call(refreshRequest({ refreshToken: TOKEN }), env);

        expect(usage.points).toEqual([]);
    });

    test('answers the same with the binding, without it and when it throws', async () => {
        const throwing: WorkerEnv['USAGE'] = {
            writeDataPoint() {
                throw new Error('Analytics Engine is down');
            },
        };
        const envs: WorkerEnv[] = [ENV, { ...ENV, USAGE: usageBinding().binding }, { ...ENV, USAGE: throwing }];

        const answers: string[][] = [];
        for (const env of envs) {
            githubAnswers(JSON.stringify({ access_token: TOKEN, scope: 'repo' }));
            const exchanged = await call(tokenRequest({ code: CODE, redirectUri: CALLBACK }), env);
            github.mockResolvedValue(new Response(null, { status: 204 }));
            const revoked = await call(revokeRequest({ token: TOKEN }), env);
            answers.push([await describeResponse(exchanged), await describeResponse(revoked)]);
        }

        expect(answers[0]?.[0]).toContain(TOKEN);
        expect(answers[1]).toEqual(answers[0]);
        expect(answers[2]).toEqual(answers[0]);
    });
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

/** A fake Analytics Engine binding that keeps every data point written to it. */
function usageBinding() {
    const points: AnalyticsEngineDataPoint[] = [];
    const binding: WorkerEnv['USAGE'] = {
        writeDataPoint(point) {
            points.push(point);
        },
    };
    return { points, binding };
}

/** A response's status, headers and body as one string, to compare answers whole. */
async function describeResponse(response: Response) {
    const headers = [...response.headers].map(([name, value]) => `${name}: ${value}`).join('\n');
    return `${response.status}\n${headers}\n${await response.clone().text()}`;
}
