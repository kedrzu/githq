import { OAUTH_CALLBACK_PATH, OAUTH_SCOPES, OAUTH_STATE_PATTERN } from '@githq/github/oauth.js';
import type { OAuthErrorBody, OAuthTokenExchangeResult } from '@githq/github/oauth.js';
import { parseJson } from '@githq/github/utils/parseJson.js';

import type { WorkerEnv } from './WorkerEnv.js';

/**
 * GitHub's OAuth web flow (D1), the half a browser cannot do alone: GitHub's token endpoint answers no CORS
 * preflight and needs the client secret, so the Worker exchanges the code. The flow:
 *
 * 1. The SPA keeps a random `state` in sessionStorage and navigates to `GET /api/auth/authorize?state=…`
 *    ({@link authorize}), which redirects to GitHub's consent screen.
 * 2. GitHub sends the browser to the SPA's route `/auth/callback?code=…&state=…`; the SPA checks the state.
 * 3. The SPA calls `POST /api/auth/token` with `{ code, redirectUri }` ({@link exchangeToken}) and keeps the
 *    token it gets back. The Worker stores nothing.
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

/** GitHub's codes are 20 hex characters; the bound only keeps a junk body from being forwarded whole. */
const MAX_CODE_LENGTH = 256;

/** `GET /api/auth/authorize?state=…`: redirects the browser to GitHub's consent screen. */
export function authorize(request: Request, env: WorkerEnv): Response {
    if (request.method !== 'GET') {
        return methodNotAllowed('GET');
    }

    const clientId = env.GITHUB_CLIENT_ID;
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
 * public, but only the Worker knows it, so the app links here.
 */
export function openApproval(request: Request, env: WorkerEnv): Response {
    if (request.method !== 'GET') {
        return methodNotAllowed('GET');
    }

    const clientId = env.GITHUB_CLIENT_ID;
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

    const clientId = env.GITHUB_CLIENT_ID;
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

    return await requestToken({ clientId, clientSecret, code, redirectUri });
}

interface RequestTokenParams {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
}

/**
 * The call to GitHub's token endpoint and the reading of its answer. GitHub reports a bad or expired code
 * with HTTP 200 and `{ error, error_description }`, so success is the presence of `access_token`, not the
 * status. Logs carry only statuses and error codes: the code, the token and the secret are never logged.
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
                code: params.code,
                redirect_uri: params.redirectUri,
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
        console.warn(`GitHub token endpoint refused the code: ${answer.error}`);
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

    return Response.json({ accessToken, scopes } satisfies OAuthTokenExchangeResult, {
        headers: { 'cache-control': 'no-store' },
    });
}

function callbackUrl(request: Request): string {
    return new URL(OAUTH_CALLBACK_PATH, request.url).href;
}

function notConfigured(): Response {
    return authError(500, {
        error: 'not_configured',
        description: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set (see .env.example)',
    });
}

function methodNotAllowed(allow: string): Response {
    return Response.json({ error: 'method_not_allowed' } satisfies OAuthErrorBody, {
        status: 405,
        headers: { allow, 'cache-control': 'no-store' },
    });
}

function authError(status: number, body: OAuthErrorBody): Response {
    return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}
