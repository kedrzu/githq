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

/** What `device_start` answers: the code to show and where the user types it. */
export interface DeviceCode {
    /** The code the user types on GitHub (`WDJB-MJHT`). */
    readonly userCode: string;
    /** The page they type it on (`https://github.com/login/device`). */
    readonly verificationUri: string;
    /** How many seconds the code is valid for, as GitHub said. */
    readonly expiresIn: number;
}

/** What `device_finish` answers once the user approved githq on GitHub. */
export interface DeviceGrant {
    readonly token: string;
    /** The scopes GitHub granted, comma-separated as GitHub sends them (`repo,project,read:org`). */
    readonly scope: string;
}

/**
 * Why a device sign-in command did not answer: `expired` — the code ran out before the user approved it; `denied` —
 * the user declined on GitHub; `offline` — GitHub could not be reached; `superseded` — a newer `device_start`
 * replaced the attempt; `failed` — anything else.
 */
export type DeviceSignInError = 'expired' | 'denied' | 'offline' | 'superseded' | 'failed';

/**
 * Why `update_restart` did not restart: `notReady` — no update is ready; `failed` — the installer could not be started
 * (Windows).
 */
export type UpdateRestartError = 'notReady' | 'failed';

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
    /**
     * `device_start`: asks GitHub for a device code, superseding any sign-in already started; rejects with a
     * {@link DeviceSignInError} (`offline`, `superseded`, `failed`).
     */
    startDeviceSignIn(): Promise<DeviceCode>;
    /**
     * `device_finish`: waits until the user approved the started sign-in on GitHub; rejects with a
     * {@link DeviceSignInError}.
     */
    finishDeviceSignIn(): Promise<DeviceGrant>;
    /**
     * Calls `listener` with the version each time the native side says an update is ready (the `update-ready`
     * event); resolves once it listens. Then ask {@link updateStatus}: an update readied before is not told again.
     */
    onUpdateReady(listener: (version: string) => void): Promise<void>;
    /** `update_status`: the version of the update ready to run, if any; never rejects. */
    updateStatus(): Promise<string | null>;
    /**
     * `update_restart`: restarts into the ready update — on Windows the installer quits the app, so it never resolves
     * there; rejects with an {@link UpdateRestartError}.
     */
    restartToUpdate(): Promise<void>;
}

/**
 * The native side of the desktop app, through what Tauri injects into its window — the only code that touches it.
 * Resolving it anywhere else (a browser) throws rather than let the app run half working.
 * Native events are listened to as Tauri's own `listen` does: the event plugin's `plugin:event|listen` command, with
 * a callback registered by `transformCallback`.
 */
export const NativeBridge = defineInterface<NativeBridgeShape>({
    name: 'NativeBridge',
    default: () => createTauriBridge(),
});

/** The part of `window.__TAURI_INTERNALS__` the bridge uses. */
interface TauriInternals {
    /** Runs a command; resolves with what it returns, rejects with its error. */
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    /** Registers a callback the native side can call; answers its id. */
    transformCallback(callback: (message: unknown) => void, once?: boolean): number;
}

/** What a native event's callback receives. */
interface TauriEventMessage {
    readonly event: string;
    readonly payload: unknown;
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
        startDeviceSignIn: () => tauri.invoke<DeviceCode>('device_start'),
        finishDeviceSignIn: () => tauri.invoke<DeviceGrant>('device_finish'),
        onUpdateReady: listener =>
            listen('update-ready', payload => {
                if (isUpdateReady(payload)) {
                    listener(payload.version);
                }
            }),
        updateStatus: () => tauri.invoke<string | null>('update_status'),
        restartToUpdate: async () => {
            await tauri.invoke<null>('update_restart');
        },
    };

    /** Calls `handler` with the payload of each `event` the native side emits; resolves once it listens. */
    async function listen(event: string, handler: (payload: unknown) => void) {
        const callback = tauri.transformCallback(message => {
            if (isEventMessage(message) && message.event === event) {
                handler(message.payload);
            }
        });
        await tauri.invoke<number>('plugin:event|listen', { event, target: { kind: 'Any' }, handler: callback });
    }
}

function readTauriInternals(): TauriInternals {
    const internals: unknown = '__TAURI_INTERNALS__' in window ? window.__TAURI_INTERNALS__ : undefined;
    if (!isTauriInternals(internals)) {
        throw new Error('The desktop build of githq runs in the githq desktop app only');
    }

    return internals;
}

function isTauriInternals(value: unknown): value is TauriInternals {
    return (
        typeof value === 'object' &&
        value !== null &&
        'invoke' in value &&
        typeof value.invoke === 'function' &&
        'transformCallback' in value &&
        typeof value.transformCallback === 'function'
    );
}

function isEventMessage(value: unknown): value is TauriEventMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'event' in value &&
        typeof value.event === 'string' &&
        'payload' in value
    );
}

function isUpdateReady(payload: unknown): payload is { version: string } {
    return (
        typeof payload === 'object' && payload !== null && 'version' in payload && typeof payload.version === 'string'
    );
}
