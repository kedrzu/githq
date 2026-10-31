// The contract between the app and the Worker for GitHub's OAuth web flow (D1): the Worker's endpoints, the
// callback route, what `state` may be and the scopes asked for. Both sides import it from here, so the two
// halves of the flow cannot drift apart. The flow itself is described in `packages/worker/src/githubOAuth.ts`.

/** The Worker's endpoint that redirects the browser to GitHub's consent screen: `GET …?state=…`. */
export const OAUTH_AUTHORIZE_PATH = '/api/auth/authorize';

/** The Worker's endpoint that trades the code for a token: `POST` JSON `{ code, redirectUri }`. */
export const OAUTH_TOKEN_PATH = '/api/auth/token';

/**
 * The Worker's endpoint that redirects the browser to GitHub's page of githq's OAuth App
 * (`github.com/settings/connections/applications/<client id>`), where the user requests an organisation's
 * approval of githq with one click (G5, D14): `GET`, opened in a new tab.
 */
export const OAUTH_APPROVAL_PATH = '/api/auth/approval';

/** The app's route GitHub sends the browser back to; it must match the OAuth App's registered callback URL. */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

/**
 * What the app may send as `state`: base64url or hex, long enough to be random and short enough to be a sane
 * query parameter. It is echoed to GitHub and back, so nothing else gets near a URL.
 */
export const OAUTH_STATE_PATTERN = /^[\w-]{16,128}$/;

/** The scopes githq asks GitHub for (D3): `repo` for issues, `project` for Projects v2, `read:org` for the user's organisations. */
export const OAUTH_SCOPES = ['repo', 'project', 'read:org'] as const;

/** What `POST` {@link OAUTH_TOKEN_PATH} answers on success. */
export interface OAuthTokenExchangeResult {
    accessToken: string;
    /** The scopes GitHub actually granted, which the user may have narrowed on the consent screen. */
    scopes: string[];
}

/** What every Worker auth endpoint answers on failure: a code (GitHub's own, when it is GitHub's error) and why. */
export interface OAuthErrorBody {
    error: string;
    description?: string;
}

/** Each scope of {@link OAUTH_SCOPES} with the broader scopes GitHub may grant instead, which include it. */
const ACCEPTED_SCOPES: Record<(typeof OAUTH_SCOPES)[number], readonly string[]> = {
    repo: ['repo'],
    project: ['project'],
    'read:org': ['read:org', 'write:org', 'admin:org'],
};

/**
 * Whether the scopes GitHub granted cover every scope githq asked for — the user may narrow them on the
 * consent screen, and githq cannot work without any of them.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function hasOAuthScopes(granted: readonly string[]): boolean {
    return OAUTH_SCOPES.every(scope => ACCEPTED_SCOPES[scope].some(accepted => granted.includes(accepted)));
}
