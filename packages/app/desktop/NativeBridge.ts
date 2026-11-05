import { defineInterface } from '@nzyme/ioc/Interface.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { UpdateActivity, UpdateState, UpdateStream } from '@/services/AppUpdate.js';

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

/** Why `update_set_stream` refused: `notAvailable` — this platform has no choice of stream (Windows). */
export type SetUpdateStreamError = 'notAvailable';

/** Which job's log `read_job_log` reads, and the token to ask GitHub with; it goes to GitHub only. */
export interface ReadJobLogParams {
    readonly owner: string;
    readonly name: string;
    readonly jobId: number;
    readonly token: string;
}

/** What `read_job_log` answers: a log (200) or a refusal (4xx, 5xx), read in full. */
export interface JobLogAnswer {
    readonly status: number;
    /** GitHub's `x-ratelimit-*` and `retry-after`, those it sent; none from the blob. */
    readonly headers: Readonly<Record<string, string>>;
    readonly text: string;
}

/**
 * Why `read_job_log` has no answer: `invalid` — not an owner or a name GitHub could have; `refused` — GitHub redirected
 * elsewhere than to a blob over https, or the blob redirected in turn; `tooLarge` — past the 256 MB read at most;
 * `offline` — GitHub or the blob could not be reached; `failed` — anything else.
 */
export type ReadJobLogError = 'invalid' | 'refused' | 'tooLarge' | 'offline' | 'failed';

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
    /** `read_job_log`: asks GitHub for a job's log and reads where it redirects; rejects with a {@link ReadJobLogError}. */
    readJobLog(params: ReadJobLogParams): Promise<JobLogAnswer>;
    /**
     * Calls `listener` with the whole state each time it changes (the `update-state` event; a payload that isn't one is
     * ignored); resolves once it listens. Then ask {@link updateStatus}: what changed before is not told again.
     */
    onUpdateState(listener: (state: UpdateState) => void): Promise<void>;
    /** `update_status`: the updater's state now; never rejects. */
    updateStatus(): Promise<UpdateState>;
    /** `update_check`: asks for a check at the user's word; if one is under way, it runs after that. */
    checkForUpdate(): Promise<void>;
    /** `update_set_stream`: follows `stream` and checks it; rejects with a {@link SetUpdateStreamError}. */
    setUpdateStream(stream: UpdateStream): Promise<void>;
    /**
     * `update_restart`: restarts into the ready update, installing it first on Linux and Windows, where the state
     * reports how that goes. Does nothing while checking, downloading or installing.
     */
    restartToUpdate(): Promise<void>;
    /**
     * Calls `listener` each time the window resizes (Tauri's `tauri://resize`), the last time after a change to or from
     * full screen has ended; resolves once it listens.
     */
    onWindowResized(listener: () => void): Promise<void>;
    /** Tauri's `is_fullscreen`: whether the window is in full screen or on its way there. */
    isFullscreen(): Promise<boolean>;
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
        readJobLog: ({ owner, name, jobId, token }) =>
            tauri.invoke<JobLogAnswer>('read_job_log', { owner, name, jobId, token }),
        onUpdateState: listener =>
            listen('update-state', payload => {
                if (isUpdateState(payload)) {
                    listener(payload);
                }
            }),
        updateStatus: () => tauri.invoke<UpdateState>('update_status'),
        checkForUpdate: async () => {
            await tauri.invoke<null>('update_check');
        },
        setUpdateStream: async stream => {
            await tauri.invoke<null>('update_set_stream', { stream });
        },
        restartToUpdate: async () => {
            await tauri.invoke<null>('update_restart');
        },
        onWindowResized: listener => listen('tauri://resize', () => listener()),
        isFullscreen: () => tauri.invoke<boolean>('plugin:window|is_fullscreen'),
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

function isUpdateState(payload: unknown): payload is UpdateState {
    return (
        isPlainObject(payload) &&
        typeof payload.version === 'string' &&
        (payload.commit === null || typeof payload.commit === 'string') &&
        (payload.stream === 'stable' || payload.stream === 'development') &&
        typeof payload.canChoose === 'boolean' &&
        typeof payload.manual === 'boolean' &&
        (payload.checkedAt === null || typeof payload.checkedAt === 'number') &&
        isUpdateActivity(payload.activity)
    );
}

function isUpdateActivity(activity: unknown): activity is UpdateActivity {
    if (!isPlainObject(activity)) {
        return false;
    }

    switch (activity.kind) {
        case 'idle':
        case 'checking':
        case 'upToDate':
        case 'noRelease':
            return true;
        case 'ready':
        case 'installing':
        case 'installFailed':
            return typeof activity.version === 'string';
        case 'downloading':
            return (
                typeof activity.version === 'string' &&
                (activity.percent === null || typeof activity.percent === 'number')
            );
        case 'failed':
            return activity.reason === 'offline' || activity.reason === 'unreachable';
        default:
            return false;
    }
}
