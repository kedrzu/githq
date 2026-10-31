import { defineInterface } from '@nzyme/ioc/Interface.js';

/** The token `token_load` found from an earlier sign-in, and whether the OS credential store works. */
export interface StoredToken {
    readonly token: string | null;
    /** `false`: the credential store does not work, so a token is kept for this run only. */
    readonly keychain: boolean;
}

/**
 * Why `open_external` did not open a page: `notWebPage` — not an `http:` or `https:` address; `failed` — the system
 * could not open the browser.
 */
export type OpenExternalError = 'notWebPage' | 'failed';

/**
 * The desktop app's native commands (`packages/desktop/src-tauri/src/lib.rs`), one method each. A command that fails
 * rejects with its error code, a bare string.
 */
export interface NativeBridgeShape {
    /** `token_load`: never rejects. */
    loadToken(): Promise<StoredToken>;
    /** `token_save`: `false` when the credential store does not work and the token is kept for this run only. */
    saveToken(token: string): Promise<boolean>;
    /** `token_delete`. */
    deleteToken(): Promise<void>;
    /** `open_external`: opens a web page in the system browser; rejects with an {@link OpenExternalError}. */
    openExternal(url: string): Promise<void>;
}

/**
 * The native side of the desktop app, through what Tauri injects into its window — the only code that touches it.
 * Resolving it anywhere else (a browser) throws rather than let the app run half working.
 *
 * Native events (Tauri's `listen`, through the event plugin's `plugin:event|listen` command and `transformCallback`)
 * come with their first user, the updater.
 */
export const NativeBridge = defineInterface<NativeBridgeShape>({
    name: 'NativeBridge',
    default: () => createTauriBridge(),
});

/** The part of `window.__TAURI_INTERNALS__` the bridge uses. */
interface TauriInternals {
    /** Runs a command; resolves with what it returns, rejects with its error. */
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

function createTauriBridge(): NativeBridgeShape {
    const tauri = readTauriInternals();
    return {
        loadToken: () => tauri.invoke<StoredToken>('token_load'),
        saveToken: token => tauri.invoke<boolean>('token_save', { token }),
        deleteToken: async () => {
            await tauri.invoke<null>('token_delete');
        },
        openExternal: async url => {
            await tauri.invoke<null>('open_external', { url });
        },
    };
}

function readTauriInternals(): TauriInternals {
    const internals: unknown = '__TAURI_INTERNALS__' in window ? window.__TAURI_INTERNALS__ : undefined;
    if (!isTauriInternals(internals)) {
        throw new Error('The desktop build of githq runs in the githq desktop app only');
    }

    return internals;
}

function isTauriInternals(value: unknown): value is TauriInternals {
    return typeof value === 'object' && value !== null && 'invoke' in value && typeof value.invoke === 'function';
}
