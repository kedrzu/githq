import type { BrowserContext, Page } from '@playwright/test';

import { OAUTH_SCOPES } from '@githq/github/oauth.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/** What a native command answers the page: its value, or the error code it rejects with (a bare string, as Tauri). */
export type FakeNativeAnswer =
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: string };

/** What `read_job_log` answers. */
export interface FakeJobLogAnswer {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly text: string;
}

/** What the updater is doing, as the native side's `UpdateState` says (`packages/desktop/src-tauri/src/updater.rs`). */
export type FakeUpdateActivity = { readonly kind: string } & Readonly<Record<string, unknown>>;

/** The updater's state, sent whole (`update-state`) and answered by `update_status`. */
export interface FakeUpdateState {
    readonly version: string;
    readonly commit: string | null;
    readonly stream: string;
    readonly canChoose: boolean;
    readonly manual: boolean;
    readonly checkedAt: number | null;
    readonly activity: FakeUpdateActivity;
}

/** What the fake puts in the page as `window.__TAURI_INTERNALS__`: the part of Tauri's the app uses. */
export interface FakeTauriInternals {
    invoke(command: string, args?: Readonly<Record<string, unknown>>): Promise<unknown>;
    transformCallback(callback: (message: unknown) => void, once?: boolean): number;
}

/** The device code `device_start` answers. */
export interface FakeDeviceCode {
    readonly userCode: string;
    readonly verificationUri: string;
    readonly expiresIn: number;
}

declare global {
    interface Window {
        /**
         * The fake's binding into the test (`exposeBinding`): runs a native command there, for the document `document`
         * of the page.
         */
        __githqE2eInvoke?: (command: string, args: unknown, document: string) => Promise<FakeNativeAnswer>;
        /**
         * Calls the callback registered as `handler` (`transformCallback`) with `message`, as the native side does —
         * unless it was registered by another document of the page, gone since.
         */
        __githqE2eEmit?: (document: string, handler: number, message: unknown) => void;
        __TAURI_INTERNALS__?: FakeTauriInternals;
    }
}

/** A command the page ran. */
interface FakeInvocation {
    readonly page: Page;
    readonly document: string;
    readonly command: string;
    readonly args: unknown;
}

/** A native event's listener, registered by the page through `plugin:event|listen`. */
interface FakeEventListener {
    readonly page: Page;
    /** The document of `page` that listens: one loaded since does not have its callback. */
    readonly document: string;
    readonly event: string;
    readonly handler: number;
}

/**
 * The desktop app's native side for the e2e tests (`packages/desktop/src-tauri`): the commands of the app's
 * `NativeBridge` (`packages/app/desktop/NativeBridge.ts`), answered here in the test through what Tauri injects into
 * its window, `window.__TAURI_INTERNALS__` — the OS credential store a field, the system browser a log of the pages it
 * opened, GitHub's device flow answered when the test says, the updater's state, `update-state`, the window's full
 * screen, a trackpad scroll's phases and the githq links opened in the app ({@link openLink}), sent when the test says. One per test; a command it does not know is recorded and fails the test ({@link assertKnownCommands}).
 */
export class FakeNativeBridge {
    /** The token in the OS credential store, or `null`. */
    keychain: string | null = null;

    /** The code `device_start` answers. */
    deviceCode: FakeDeviceCode = {
        userCode: 'WDJB-MJHT',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
    };

    /** What `read_job_log` answers for each job id; a job not here fails as the native side does offline. */
    readonly jobLogs = new Map<number, FakeJobLogAnswer>();

    /** The code `read_job_log` fails with for each job id, before anything in {@link jobLogs}. */
    readonly jobLogFailures = new Map<number, string>();

    /** What `update_status` answers; set by {@link sendUpdateState} too. */
    updateState: FakeUpdateState = {
        version: '1.3.0',
        commit: null,
        stream: 'stable',
        canChoose: true,
        manual: false,
        checkedAt: null,
        activity: { kind: 'idle' },
    };

    /**
     * The app address of the githq link opened and not taken yet, which `link_take` answers and clears. Set before the
     * first page load for an app started with a link.
     */
    pendingLink: string | null = null;

    /** What `plugin:window|is_fullscreen` answers; set by {@link setFullscreen}. */
    private fullscreen = false;

    private readonly openedUrls: string[] = [];
    private readonly jobLogReads: unknown[] = [];
    private readonly listeners: FakeEventListener[] = [];
    private readonly unknownCommands: string[] = [];
    private restarts = 0;
    private checks = 0;
    private readonly chosenStreams: string[] = [];
    /** What the current attempt's `device_finish` answers, once the test says. */
    private deviceAnswer = createPromise<FakeNativeAnswer>();

    /** Puts the native side into every page of `context`, from the next page loaded on. */
    async install(context: BrowserContext): Promise<void> {
        await context.exposeBinding(
            '__githqE2eInvoke',
            ({ page }, command: unknown, args: unknown, document: unknown) =>
                this.invoke({
                    page,
                    document: typeof document === 'string' ? document : '',
                    command: typeof command === 'string' ? command : '',
                    args,
                }),
        );
        await context.addInitScript(installTauriInternals);
    }

    /** The pages `open_external` opened in the system browser, oldest first. */
    get opened(): readonly string[] {
        return this.openedUrls;
    }

    /** The arguments of each `read_job_log`, oldest first. */
    get jobLogRequests(): readonly unknown[] {
        return this.jobLogReads;
    }

    /** How many times `update_restart` restarted into the ready update. */
    get restartCount(): number {
        return this.restarts;
    }

    /** How many times `update_check` asked for a check. */
    get checkCount(): number {
        return this.checks;
    }

    /** The streams `update_set_stream` chose, oldest first. */
    get streamChanges(): readonly string[] {
        return this.chosenStreams;
    }

    /** Whether a page listens to the native event `event`. */
    isListening(event: string): boolean {
        return this.listeners.some(listener => listener.event === event);
    }

    /** The user approved the device sign-in on GitHub: `device_finish` answers `token` with every scope githq asks. */
    approveDeviceSignIn(token: string): void {
        this.deviceAnswer.resolve({
            ok: true,
            value: { token, scope: OAUTH_SCOPES.join(','), refreshToken: null, expiresIn: null },
        });
    }

    /** The updater's state changed: `update_status` answers it, and every page listening hears `update-state`. */
    async sendUpdateState(change: Partial<FakeUpdateState>): Promise<void> {
        this.updateState = { ...this.updateState, ...change };
        await this.emit('update-state', this.updateState);
    }

    /** The window went to or left full screen, which ends with it resizing (`tauri://resize`). */
    async setFullscreen(fullscreen: boolean): Promise<void> {
        this.fullscreen = fullscreen;
        await this.emit('tauri://resize', { width: 1280, height: 800 });
    }

    /** The fingers came down on the trackpad to scroll, lifted off, or the system cancelled the scroll (`scroll-phase`). */
    async sendScrollPhase(phase: 'began' | 'ended' | 'cancelled'): Promise<void> {
        await this.emit('scroll-phase', phase);
    }

    /** A githq link was opened in the app: `link_take` answers `address`, and every page listening hears `link-opened`. */
    async openLink(address: string): Promise<void> {
        this.pendingLink = address;
        await this.emit('link-opened', null);
    }

    /** Throws when the app ran a command the fake does not know, naming each. */
    assertKnownCommands(): void {
        if (this.unknownCommands.length > 0) {
            throw new Error(
                `The app ran native commands the fake does not know (FakeNativeBridge): ${this.unknownCommands.join(', ')}`,
            );
        }
    }

    /** Every page listening to `name` hears it. */
    private async emit(name: string, payload: unknown): Promise<void> {
        for (const { page, document, event, handler } of this.listeners) {
            if (event === name) {
                await page.evaluate(([to, id, message]) => window.__githqE2eEmit?.(to, id, message), [
                    document,
                    handler,
                    { event, payload },
                ] as const);
            }
        }
    }

    private async invoke({ page, document, command, args }: FakeInvocation): Promise<FakeNativeAnswer> {
        switch (command) {
            case 'token_load':
                return { ok: true, value: { token: this.keychain, keychain: true } };
            case 'token_save':
                this.keychain = readString(args, 'token');
                return { ok: true, value: true };
            case 'token_delete':
                this.keychain = null;
                return { ok: true, value: null };
            case 'open_external':
                this.openedUrls.push(readString(args, 'url'));
                return { ok: true, value: null };
            case 'read_job_log': {
                this.jobLogReads.push(args);
                const jobId = isPlainObject(args) && typeof args.jobId === 'number' ? args.jobId : -1;
                const failure = this.jobLogFailures.get(jobId);
                if (failure !== undefined) {
                    return { ok: false, error: failure };
                }

                const log = this.jobLogs.get(jobId);
                return log ? { ok: true, value: log } : { ok: false, error: 'offline' };
            }
            case 'device_start':
                // A new attempt supersedes the one under way, as the native side does.
                this.deviceAnswer.resolve({ ok: false, error: 'superseded' });
                this.deviceAnswer = createPromise();
                return { ok: true, value: this.deviceCode };
            case 'device_finish':
                return await this.deviceAnswer.promise;
            case 'update_status':
                return { ok: true, value: this.updateState };
            case 'update_check':
                this.checks++;
                return { ok: true, value: null };
            case 'update_set_stream':
                if (!this.updateState.canChoose) {
                    return { ok: false, error: 'notAvailable' };
                }

                this.chosenStreams.push(readString(args, 'stream'));
                await this.sendUpdateState({ stream: readString(args, 'stream'), manual: true });
                return { ok: true, value: null };
            case 'update_restart':
                // Does nothing while checking, downloading or installing, as the native side.
                if (['ready', 'installFailed'].includes(this.updateState.activity.kind)) {
                    this.restarts++;
                }

                return { ok: true, value: null };
            case 'link_take': {
                const address = this.pendingLink;
                this.pendingLink = null;
                return { ok: true, value: address };
            }
            case 'plugin:window|is_fullscreen':
                return { ok: true, value: this.fullscreen };
            case 'plugin:event|listen': {
                const handler = isPlainObject(args) && typeof args.handler === 'number' ? args.handler : -1;
                this.listeners.push({ page, document, event: readString(args, 'event'), handler });
                return { ok: true, value: handler };
            }
            default:
                this.unknownCommands.push(command);
                return { ok: false, error: 'unknown command' };
        }
    }
}

/**
 * Runs in the page, before the app: Tauri's `__TAURI_INTERNALS__`, its commands sent to the test, and its callbacks
 * kept for the events the test sends. A command fails as Tauri's do, rejecting with its error code.
 */
function installTauriInternals() {
    const callbacks = new Map<number, (message: unknown) => void>();
    let nextId = 1;
    // This document, apart from the page's earlier ones: their callbacks are gone with them.
    const document = crypto.randomUUID();

    window.__githqE2eEmit = (to, handler, message) => {
        if (to === document) {
            callbacks.get(handler)?.(message);
        }
    };
    window.__TAURI_INTERNALS__ = {
        invoke: async (command, args) => {
            const invoke = window.__githqE2eInvoke;
            if (!invoke) {
                throw new Error('The fake native side is not bound');
            }

            const answer = await invoke(command, args ?? {}, document);
            // A command that fails rejects with its error code, a bare string, as Tauri's do.
            const result = Promise.withResolvers<unknown>();
            if (answer.ok) {
                result.resolve(answer.value);
            } else {
                result.reject(answer.error);
            }

            return await result.promise;
        },
        transformCallback: (callback, once) => {
            const id = nextId++;
            callbacks.set(id, message => {
                if (once) {
                    callbacks.delete(id);
                }

                callback(message);
            });
            return id;
        },
    };
}

/** The string argument `key` of a command; empty when the app sent none. */
function readString(args: unknown, key: string): string {
    const value = isPlainObject(args) ? args[key] : undefined;
    return typeof value === 'string' ? value : '';
}
