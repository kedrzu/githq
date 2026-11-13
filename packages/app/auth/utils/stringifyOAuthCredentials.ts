import type { OAuthCredentials } from '@githq/github/oauth.js';

/**
 * The credentials as a token vault keeps them: JSON of exactly their three fields, which
 * {@link parseOAuthCredentials} reads back.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function stringifyOAuthCredentials(credentials: OAuthCredentials): string {
    const { accessToken, refreshToken, expiresAt } = credentials;
    return JSON.stringify({ accessToken, refreshToken, expiresAt });
}
