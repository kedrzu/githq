import { stringifyOAuthCredentials } from '@/auth/utils/stringifyOAuthCredentials.js';

/**
 * What the token vault keeps for `accessToken` when it never expires (no refresh token), for a test to seed a session.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function storedToken(accessToken: string): string {
    return stringifyOAuthCredentials({ accessToken, refreshToken: null, expiresAt: null });
}
