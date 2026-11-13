import { getOAuthClientId, OAUTH_CALLBACK_PATH, OAUTH_SCOPES, OAUTH_STATE_PATTERN } from '@githq/github/oauth.js';
import type { OAuthErrorBody, OAuthTokenExchangeResult } from '@githq/github/oauth.js';
import { parseJson } from '@githq/github/utils/parseJson.js';

import { getUsageClient, isUsageOptedOut, recordUsage } from './usage.js';
import type { WorkerEnv } from './WorkerEnv.js';

/**
 * GitHub's OAuth web flow (D1), the half a browser cannot do alone: GitHub's token endpoint answers no CORS
 * preflight and needs the client secret, so the Worker exchanges the code. The flow:
 *
 * 1. The SPA keeps a random `state` in sessionStorage and navigates to `GET /api/auth/authorize?state=…`
 *    ({@link authorize}), which redirects to GitHub's consent screen.
 * 2. GitHub sends the browser to the SPA's route `/auth/callback?code=…&state=…`; the SPA checks the state.
 * 3. The SPA calls `POST /api/auth/token` with `{ code, redirectUri }` ({@link exchangeToken}) and keeps the
 *    token it gets back, with its refresh token and expiry. The Worker stores nothing.
 * 4. GitHub's access tokens expire after 8 hours: the app trades the refresh token for new ones at
 *    `POST /api/auth/refresh` ({@link refreshAccessToken}), which needs the client secret as well.
 *
 * A token created, refreshed or revoked is counted (`usage.ts`) unless the body carries `telemetry: false`; a refused
 * or failed request is not.
 *
 * The paths, the scopes and what `state` may be are the contract shared with the app (`@githq/github/oauth.js`).
 *
 * The callback is always `<the request's origin>/auth/callback`. In production that is the githq domain. In
 * development the app is opened on `nuxt dev` (8787), whose proxy rewrites `Host` to the Worker's 8788 and
 * sends no `X-Forwarded-Host` (only `X-Forwarded-Port`, which a client can set too) — so instead of trusting
 * headers, `wrangler dev` is told the app's origin (`dev.host` in `wrangler.jsonc`) and hands it to the Worker
 * as `request.url`'s. One rule, no header that a client could forge.
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
/** GitHub's page of an OAuth App the user authorised, followed by its client ID. */
const GITHUB_APPLICATION_URL = 'https://github.com/settings/connections/applications/';

/** GitHub's REST API, where an OAuth App's token is revoked. */
const GITHUB_API_URL = 'https://api.github.com';

/** GitHub's codes are 20 hex characters; the bound only keeps a junk body from being forwarded whole. */
const MAX_CODE_LENGTH = 256;

/**
 * An OAuth App's user token: a prefix and base62 (40 characters today; GitHub allows for up to 255). `gho_` is the
 * OAuth App token's documented prefix; `ghu_` (a GitHub App's expiring user token) is accepted too, since which prefix
 * an OAuth App's expiring token carries is unverified.
 */
const OAUTH_APP_TOKEN_PATTERN = /^gh[ou]_[A-Za-z0-9]{1,251}$/;

/** A refresh token: `ghr_` and base62 (the prefix GitHub Apps' refresh tokens carry; unverified for OAuth Apps). */
const REFRESH_TOKEN_PATTERN = /^ghr_[A-Za-z0-9]{1,251}$/;

/**
 * What {@link refreshAccessToken} and {@link revokeToken} answer every origin with: a plain JSON `POST`, no
 * credentials.
 */
const OPEN_CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
};

/** `GET /api/auth/authorize?state=…`: redirects the browser to GitHub's consent screen. */
export function authorize(request: Request, env: WorkerEnv): Response {
    if (request.method !== 'GET') {
        return methodNotAllowed('GET');
    }

    const clientId = getOAuthClientId(env.GITHQ_ENV);
    if (!clientId || !env.GITHUB_CLIENT_SECRET) {
        return notConfigured();
    }

    const state = new URL(request.url).searchParams.get('state');
    if (state == null || !OAUTH_STATE_PATTERN.test(state)) {
        return authError(400, {
            error: 'invalid_state',
            description: 'state must be 16–128 characters of A–Z, a–z, 0–9, _ and -',
        });
    }

    const location = new URL(GITHUB_AUTHORIZE_URL);
    location.searchParams.set('client_id', clientId);
    location.searchParams.set('redirect_uri', callbackUrl(request));
    location.searchParams.set('scope', OAUTH_SCOPES.join(' '));
    location.searchParams.set('state', state);

    return new Response(null, {
        status: 302,
        headers: { location: location.href, 'cache-control': 'no-store' },
    });
}

/**
 * `GET /api/auth/approval`: redirects the browser to GitHub's page of githq's OAuth App, where the user asks an
 * organisation that hides its private data from third-party apps to approve githq (G5, D14). The client ID is
 * public, but only the Worker knows which environment it runs in, so the app links here.
 */
export function openApproval(request: Request, env: WorkerEnv): Response {
    if (request.method !== 'GET') {
        return methodNotAllowed('GET');
    }

    const clientId = getOAuthClientId(env.GITHQ_ENV);
    if (!clientId) {
        return notConfigured();
    }

    return new Response(null, {
        status: 302,
        headers: { location: GITHUB_APPLICATION_URL + encodeURIComponent(clientId), 'cache-control': 'no-store' },
    });
}

/**
 * `POST /api/auth/token` with JSON `{ code, redirectUri }`: trades the code for an access token at GitHub.
 *
 * Only JSON is accepted, which makes a cross-site call a CORS preflight that the Worker never approves — so no
 * other site can read a token out of this endpoint. `redirectUri` must be this origin's callback (the one
 * {@link authorize} sent to GitHub), so a code issued for some other site is never exchanged here.
 */
export async function exchangeToken(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method !== 'POST') {
        return methodNotAllowed('POST');
    }

    const clientId = getOAuthClientId(env.GITHQ_ENV);
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return notConfigured();
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json\s*(;|$)/i.test(contentType)) {
        return authError(415, { error: 'unsupported_media_type', description: 'Send application/json' });
    }

    // A body the client stopped sending reads as none.
    const body = parseJson(await request.text().catch(() => null));
    if (typeof body !== 'object' || body === null) {
        return authError(400, { error: 'invalid_request', description: 'The body is not a JSON object' });
    }

    const code = 'code' in body ? body.code : undefined;
    if (typeof code !== 'string' || code === '' || code.length > MAX_CODE_LENGTH) {
        return authError(400, { error: 'invalid_request', description: 'code is missing or malformed' });
    }

    const redirectUri = callbackUrl(request);
    if (!('redirectUri' in body) || body.redirectUri !== redirectUri) {
        return authError(400, {
            error: 'invalid_redirect_uri',
            description: `redirectUri must be ${redirectUri}`,
        });
    }

    const response = await requestToken({ clientId, clientSecret, grant: { code, redirect_uri: redirectUri } });
    // 200 is only ever the answer with the token; every refusal and failure has an error status.
    if (response.ok && !isUsageOptedOut(body)) {
        recordUsage(env, 'token_created', { client: getUsageClient(request), platform: '' });
    }
    return response;
}

/**
 * `POST /api/auth/refresh` with JSON `{ refreshToken }`: trades a refresh token for a new access token and a new
 * refresh token at GitHub, which needs the client secret. Answers like {@link exchangeToken}; a refresh token GitHub
 * no longer accepts is a `400` with GitHub's `bad_refresh_token`.
 *
 * It answers CORS for any origin, like {@link revokeToken} and for the same reasons: the desktop app's webview calls
 * it, only a refresh token the caller holds can be used, the token travels in the body only, and anything not shaped
 * like a refresh token is refused before GitHub is asked.
 */
export async function refreshAccessToken(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS });
    }

    if (request.method !== 'POST') {
        return withOpenCors(methodNotAllowed('POST, OPTIONS'));
    }

    const clientId = getOAuthClientId(env.GITHQ_ENV);
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return withOpenCors(notConfigured());
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json\s*(;|$)/i.test(contentType)) {
        return withOpenCors(authError(415, { error: 'unsupported_media_type', description: 'Send application/json' }));
    }

    const body = parseJson(await request.text().catch(() => null));
    const token = typeof body === 'object' && body !== null && 'refreshToken' in body ? body.refreshToken : undefined;
    if (typeof token !== 'string' || !REFRESH_TOKEN_PATTERN.test(token)) {
        return withOpenCors(
            authError(400, { error: 'invalid_request', description: 'refreshToken is missing or malformed' }),
        );
    }

    const response = await requestToken({
        clientId,
        clientSecret,
        grant: { grant_type: 'refresh_token', refresh_token: token },
    });
    // As with the exchange, only a 200 carries new tokens: a refused or failed renewal is not counted.
    if (response.ok && !isUsageOptedOut(body)) {
        recordUsage(env, 'token_refreshed', { client: getUsageClient(request), platform: '' });
    }
    return withOpenCors(response);
}

/**
 * `POST /api/auth/revoke` with JSON `{ token }`: revokes an OAuth token of githq's OAuth App at GitHub, which needs
 * the client secret. `204` whether GitHub still knew the token or not, so the endpoint tells no one whether a token
 * is alive.
 *
 * Unlike the rest, it answers CORS for any origin: the desktop app's webview calls it from its own origin. That gives
 * no one anything, since only a token the caller holds can be revoked. The token travels in the body only, never in
 * the URL that the Worker's logs record, and anything not shaped like an OAuth App token is refused before GitHub is
 * asked, so the open endpoint cannot spend githq's credentials on junk.
 */
export async function revokeToken(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS });
    }

    if (request.method !== 'POST') {
        return withOpenCors(methodNotAllowed('POST, OPTIONS'));
    }

    const clientId = getOAuthClientId(env.GITHQ_ENV);
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return withOpenCors(notConfigured());
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json\s*(;|$)/i.test(contentType)) {
        return withOpenCors(authError(415, { error: 'unsupported_media_type', description: 'Send application/json' }));
    }

    const body = parseJson(await request.text().catch(() => null));
    const token = typeof body === 'object' && body !== null && 'token' in body ? body.token : undefined;
    if (typeof token !== 'string' || !OAUTH_APP_TOKEN_PATTERN.test(token)) {
        return withOpenCors(
            authError(400, { error: 'invalid_request', description: 'token is missing or not an OAuth App token' }),
        );
    }

    let response: Response;
    try {
        response = await fetch(`${GITHUB_API_URL}/applications/${encodeURIComponent(clientId)}/token`, {
            method: 'DELETE',
            headers: {
                accept: 'application/vnd.github+json',
                authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                'content-type': 'application/json',
                'user-agent': 'githq',
            },
            body: JSON.stringify({ access_token: token }),
        });
    } catch {
        console.error('GitHub token revocation unreachable');
        return withOpenCors(authError(502, { error: 'github_unreachable' }));
    }

    // 404: GitHub no longer knows the token (revoked already); undocumented, observed. Only a 204 is counted: a 404
    // would also answer any made-up token, so counting it would let anyone inflate the sign-outs.
    if (response.status === 204 || response.status === 404) {
        if (response.status === 204 && !isUsageOptedOut(body)) {
            recordUsage(env, 'token_revoked', { client: getUsageClient(request), platform: '' });
        }
        return new Response(null, { status: 204, headers: { ...OPEN_CORS_HEADERS, 'cache-control': 'no-store' } });
    }

    console.error(`GitHub token revocation answered ${response.status}`);
    return withOpenCors(
        authError(502, {
            error: 'github_bad_response',
            description: `GitHub answered ${response.status}`,
        }),
    );
}

interface RequestTokenParams {
    clientId: string;
    clientSecret: string;
    /** The form fields of the grant: the code and its redirect URI, or the refresh grant and its refresh token. */
    grant: Record<string, string>;
}

/**
 * The call to GitHub's token endpoint and the reading of its answer, for the code exchange and the refresh alike.
 * GitHub reports a bad or expired code or refresh token with HTTP 200 and `{ error, error_description }`, so success
 * is the presence of `access_token`, not the status. Logs carry only statuses and error codes: the code, the tokens
 * and the secret are never logged.
 */
async function requestToken(params: RequestTokenParams): Promise<Response> {
    let response: Response;
    let text: string;
    try {
        response = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: { accept: 'application/json' },
            body: new URLSearchParams({
                client_id: params.clientId,
                client_secret: params.clientSecret,
                ...params.grant,
            }),
        });
        // Read here too: a connection dropped while the answer arrives rejects the read.
        text = await response.text();
    } catch {
        console.error('GitHub token endpoint unreachable');
        return authError(502, { error: 'github_unreachable' });
    }

    const answer = response.ok ? parseJson(text) : undefined;
    if (typeof answer !== 'object' || answer === null) {
        console.error(`GitHub token endpoint answered ${response.status} without a JSON object`);
        return authError(502, {
            error: 'github_bad_response',
            description: `GitHub answered ${response.status} without a JSON object`,
        });
    }

    if ('error' in answer && typeof answer.error === 'string') {
        const description =
            'error_description' in answer && typeof answer.error_description === 'string'
                ? answer.error_description
                : undefined;
        console.warn(`GitHub token endpoint refused the grant: ${answer.error}`);
        // A wrong client ID or secret is the Worker's configuration, not anything the user can retry.
        return authError(answer.error === 'incorrect_client_credentials' ? 500 : 400, {
            error: answer.error,
            description,
        });
    }

    const accessToken = 'access_token' in answer ? answer.access_token : undefined;
    if (typeof accessToken !== 'string' || accessToken === '') {
        console.error('GitHub token endpoint answered without an access token');
        return authError(502, { error: 'github_bad_response' });
    }

    const scope = 'scope' in answer && typeof answer.scope === 'string' ? answer.scope : '';
    const scopes = scope
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '');

    const refreshToken =
        'refresh_token' in answer && typeof answer.refresh_token === 'string' && answer.refresh_token !== ''
            ? answer.refresh_token
            : null;
    const expiresIn =
        'expires_in' in answer && typeof answer.expires_in === 'number' && answer.expires_in > 0
            ? answer.expires_in
            : null;

    return Response.json({ accessToken, refreshToken, expiresIn, scopes } satisfies OAuthTokenExchangeResult, {
        headers: { 'cache-control': 'no-store' },
    });
}

function callbackUrl(request: Request): string {
    return new URL(OAUTH_CALLBACK_PATH, request.url).href;
}

function notConfigured(): Response {
    return authError(500, {
        error: 'not_configured',
        description: 'GITHUB_CLIENT_SECRET is not set, or GITHQ_ENV names no OAuth App (see the secrets skill)',
    });
}

function methodNotAllowed(allow: string): Response {
    return Response.json({ error: 'method_not_allowed' } satisfies OAuthErrorBody, {
        status: 405,
        headers: { allow, 'cache-control': 'no-store' },
    });
}

function withOpenCors(response: Response): Response {
    for (const [name, value] of Object.entries(OPEN_CORS_HEADERS)) {
        response.headers.set(name, value);
    }
    return response;
}

function authError(status: number, body: OAuthErrorBody): Response {
    return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}
