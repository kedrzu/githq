import type { OAuthCredentials } from '@githq/github/oauth.js';
import { parseJson } from '@githq/github/utils/parseJson.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/**
 * Reads the credentials a token vault kept ({@link stringifyOAuthCredentials}). Anything else — nothing kept, a bare
 * token from before the credentials were kept whole, junk — is `null`: signed out, never a throw at startup.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseOAuthCredentials(text: string | null): OAuthCredentials | null {
    const stored = parseJson(text);
    if (
        !isPlainObject(stored) ||
        typeof stored.accessToken !== 'string' ||
        stored.accessToken === '' ||
        !(typeof stored.refreshToken === 'string' || stored.refreshToken === null) ||
        !(typeof stored.expiresAt === 'number' || stored.expiresAt === null)
    ) {
        return null;
    }

    return { accessToken: stored.accessToken, refreshToken: stored.refreshToken, expiresAt: stored.expiresAt };
}
