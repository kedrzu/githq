import type { OAuthTokenExchangeResult } from '@githq/github/oauth.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/**
 * Reads what the Worker's token endpoints answer on success, the sign-in's exchange and the refresh alike; anything
 * else is `null`. A missing refresh token or expiry is `null`: a token that does not expire.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function readOAuthTokenAnswer(body: unknown): OAuthTokenExchangeResult | null {
    if (
        !isPlainObject(body) ||
        typeof body.accessToken !== 'string' ||
        body.accessToken === '' ||
        !Array.isArray(body.scopes)
    ) {
        return null;
    }

    return {
        accessToken: body.accessToken,
        refreshToken: typeof body.refreshToken === 'string' ? body.refreshToken : null,
        expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : null,
        scopes: body.scopes.filter(scope => typeof scope === 'string'),
    };
}
