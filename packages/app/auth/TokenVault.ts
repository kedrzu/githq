import type { OAuthCredentials } from '@githq/github/oauth.js';
import { defineInterface } from '@nzyme/ioc/Interface.js';

import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';

import { parseOAuthCredentials } from './utils/parseOAuthCredentials.js';
import { stringifyOAuthCredentials } from './utils/stringifyOAuthCredentials.js';

/**
 * Where the web app keeps the credentials (`localStorage`, JSON): githq has no server to hold them (D1). Nothing else
 * in the app's storage holds a token.
 */
export const TOKEN_KEY = 'githq.token';

/**
 * Where the session's OAuth credentials — the access token and what renews it — are kept between runs of the app. They
 * are never logged.
 */
export interface TokenVaultShape {
    /**
     * The kept credentials, or `null` — also for a value it cannot read; read at once, so the app opens straight into
     * the session. A fresh object on every call: compare the access tokens, not the objects.
     */
    read(): OAuthCredentials | null;
    /** Keeps `credentials` in place of any earlier ones. */
    write(credentials: OAuthCredentials): void;
    /** Forgets the credentials. */
    remove(): void;
    /** Calls `listener` when the token is changed from elsewhere — another tab of the app — not by this vault. */
    onChange(listener: () => void): void;
    /**
     * Whether the token outlives this run of the app. `false` only in the desktop app without a working credential
     * store: the token is then kept in memory and the user signs in again at the next start, which the sign-in screen
     * says up front.
     */
    readonly persistent: boolean;
}

/** The session's credentials: in `localStorage`, shared by every tab of the app, unless the app sets another vault. */
export const TokenVault = defineInterface<TokenVaultShape>({
    name: 'TokenVault',
    default: container => createLocalStorageTokenVault(container.resolve(Browser)),
});

function createLocalStorageTokenVault(browser: BrowserShape): TokenVaultShape {
    return {
        persistent: true,
        read: () => parseOAuthCredentials(browser.localStorage.getItem(TOKEN_KEY)),
        write: credentials => {
            browser.localStorage.setItem(TOKEN_KEY, stringifyOAuthCredentials(credentials));
        },
        remove: () => {
            browser.localStorage.removeItem(TOKEN_KEY);
        },
        onChange: listener => {
            browser.onLocalStorageChange(key => {
                // `null`: another tab cleared the whole storage, the token with it.
                if (key === TOKEN_KEY || key === null) {
                    listener();
                }
            });
        },
    };
}
