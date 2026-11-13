import type { OAuthCredentials } from '@githq/github/oauth.js';
import type { Logger } from '@nzyme/logging/Logger.js';

import type { TokenVaultShape } from '@/auth/TokenVault.js';
import { parseOAuthCredentials } from '@/auth/utils/parseOAuthCredentials.js';
import { stringifyOAuthCredentials } from '@/auth/utils/stringifyOAuthCredentials.js';

import type { NativeBridgeShape, StoredToken } from './NativeBridge.js';

/** The parameters of {@link createDesktopTokenVault}. */
export interface CreateDesktopTokenVaultParams {
    readonly bridge: NativeBridgeShape;
    /** What `token_load` found when the app started, so the vault reads at once. */
    readonly stored: StoredToken;
    readonly logger: Logger;
}

/**
 * The desktop app's token vault: the OS credential store, through the native side — never the webview's storages.
 * The credentials go there as one JSON string (the native side keeps it as it is), read once, when the app starts, and
 * kept in memory from then on; the app has one window, so nothing else changes them.
 */
export function createDesktopTokenVault({ bridge, stored, logger }: CreateDesktopTokenVaultParams): TokenVaultShape {
    let credentials = parseOAuthCredentials(stored.token);
    let persistent = stored.keychain;
    // The native side runs its commands side by side: here they run one after another, so a sign-out right after a
    // sign-in ends with no token kept.
    let queue = Promise.resolve();

    return {
        get persistent() {
            return persistent;
        },
        read: () => (credentials === null ? null : { ...credentials }),
        write,
        remove,
        onChange: () => {},
    };

    function write(value: OAuthCredentials) {
        credentials = { ...value };
        const text = stringifyOAuthCredentials(value);
        enqueue(async () => {
            try {
                // `false`: the credential store failed, the native side keeps the token for this run only.
                if (!(await bridge.saveToken(text))) {
                    persistent = false;
                }
            } catch (error) {
                logger.warn('Could not keep the token in the credential store', { error });
            }
        });
    }

    function remove() {
        credentials = null;
        enqueue(async () => {
            try {
                await bridge.deleteToken();
            } catch (error) {
                logger.warn('Could not remove the token from the credential store', { error });
            }
        });
    }

    function enqueue(task: () => Promise<void>) {
        queue = queue.then(task);
    }
}
