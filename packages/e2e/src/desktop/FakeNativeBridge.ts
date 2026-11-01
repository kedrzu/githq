import type { BrowserContext, Page } from '@playwright/test';

import { OAUTH_SCOPES } from '@githq/github/oauth.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/** What a native command answers the page: its value, or the error code it rejects with (a bare string, as Tauri). */
export type FakeNativeAnswer =
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: string };

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
 * opened, GitHub's device flow answered when the test says, and the updater's `update-ready` event sent when the test
 * says. One per test; a command it does not know is recorded and fails the test ({@link assertKnownCommands}).
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

    /** The version of the update ready to run (`update_status`); set by {@link sendUpdateReady} too. */
    readyUpdate: string | null = null;

    private readonly openedUrls: string[] = [];
    private readonly listeners: FakeEventListener[] = [];
    private readonly unknownCommands: string[] = [];
    private restarts = 0;
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

    /** How many times `update_restart` restarted into the ready update. */
    get restartCount(): number {
        return this.restarts;
    }

    /** Whether a page listens to the native event `event`. */
    isListening(event: string): boolean {
        return this.listeners.some(listener => listener.event === event);
    }

    /** The user approved the device sign-in on GitHub: `device_finish` answers `token` with every scope githq asks. */
    approveDeviceSignIn(token: string): void {
        this.deviceAnswer.resolve({ ok: true, value: { token, scope: OAUTH_SCOPES.join(',') } });
    }

    /** The updater readied `version`: `update_status` answers it, and every page listening hears `update-ready`. */
    async sendUpdateReady(version: string): Promise<void> {
        this.readyUpdate = version;
        for (const { page, document, event, handler } of this.listeners) {
            if (event === 'update-ready') {
                await page.evaluate(([to, id, message]) => window.__githqE2eEmit?.(to, id, message), [
                    document,
                    handler,
                    { event, payload: { version } },
                ] as const);
            }
        }
    }

    /** Throws when the app ran a command the fake does not know, naming each. */
    assertKnownCommands(): void {
        if (this.unknownCommands.length > 0) {
            throw new Error(
                `The app ran native commands the fake does not know (FakeNativeBridge): ${this.unknownCommands.join(', ')}`,
            );
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
            case 'device_start':
                // A new attempt supersedes the one under way, as the native side does.
                this.deviceAnswer.resolve({ ok: false, error: 'superseded' });
                this.deviceAnswer = createPromise();
                return { ok: true, value: this.deviceCode };
            case 'device_finish':
                return await this.deviceAnswer.promise;
            case 'update_status':
                return { ok: true, value: this.readyUpdate };
            case 'update_restart':
                if (this.readyUpdate === null) {
                    return { ok: false, error: 'notReady' };
                }

                this.restarts++;
                return { ok: true, value: null };
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
