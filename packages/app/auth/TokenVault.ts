import { defineInterface } from '@nzyme/ioc/Interface.js';

import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';

/** Where the web app keeps the token (`localStorage`): githq has no server to hold it (D1). */
export const TOKEN_KEY = 'githq.token';

/** Where the session's OAuth token is kept between runs of the app. The token is never logged. */
export interface TokenVaultShape {
    /** The kept token, or `null`; read at once, so the app opens straight into the session. */
    read(): string | null;
    /** Keeps `token` in place of any earlier one. */
    write(token: string): void;
    /** Forgets the token. */
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

/** The session's token: in `localStorage`, shared by every tab of the app, unless the app sets another vault. */
export const TokenVault = defineInterface<TokenVaultShape>({
    name: 'TokenVault',
    default: container => createLocalStorageTokenVault(container.resolve(Browser)),
});

function createLocalStorageTokenVault(browser: BrowserShape): TokenVaultShape {
    return {
        persistent: true,
        read: () => browser.localStorage.getItem(TOKEN_KEY),
        write: token => {
            browser.localStorage.setItem(TOKEN_KEY, token);
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
