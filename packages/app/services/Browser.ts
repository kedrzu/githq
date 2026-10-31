import { defineInterface } from '@nzyme/ioc/Interface.js';
import type { Fetch } from '@nzyme/types/Fetch.js';

/** The part of `Storage` the app uses. */
export type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

/** The part of `localStorage` the app uses: its keys can be listed too, to clear what an older githq left. */
export type BrowserLocalStorage = BrowserStorage & Pick<Storage, 'key' | 'length'>;

/** A `BroadcastChannel` this tab opened: what it posts reaches the app's other tabs on the channel, not this one. */
export interface BrowserChannel {
    /** Posts `message` (structured-cloned) to the other tabs. */
    post(message: unknown): void;
    /** Leaves the channel: nothing more is posted or received. */
    close(): void;
}

/**
 * What happens to the page beyond being shown or hidden: `pagehide` — it is closed or left; `freeze` — the browser
 * suspends it (a background tab), so its timers stop; `resume` — it runs again after a freeze.
 */
export type PageLifecycleEvent = 'pagehide' | 'freeze' | 'resume';

/**
 * What the app's services take from the browser: the network and whether there is one, the two storages and
 * how much the app keeps, the app's origin, whether the tab is shown, leaving for another page or opening one beside it, and what the app's
 * tabs share — a Web Lock and a broadcast channel. Behind an interface so the services
 * can run under `bun test` with stand-ins.
 */
export interface BrowserShape {
    readonly fetch: Fetch;
    /** Kept across tabs and restarts: the token and the signed-in user. */
    readonly localStorage: BrowserLocalStorage;
    /** Kept by this tab only: the sign-in's `state` while the user is on GitHub. */
    readonly sessionStorage: BrowserStorage;
    /** The app's origin, e.g. `https://githq.dev`. */
    readonly origin: string;
    /** Fills a buffer with random bytes (`crypto.getRandomValues`). */
    getRandomValues(bytes: Uint8Array<ArrayBuffer>): void;
    /** Leaves the app for `url` (a full page load). */
    navigate(url: string): void;
    /** Opens `url` in a new tab, the app staying where it is. */
    openInNewTab(url: string): void;
    /**
     * Calls `listener` when another tab of the app changes `localStorage` (the `storage` event), with the key
     * it changed — `null` when it cleared the whole storage. Changes made by this tab are not reported.
     */
    onLocalStorageChange(listener: (key: string | null) => void): void;
    /** Whether the tab is shown (`document.visibilityState`): a hidden one syncs less often. */
    isVisible(): boolean;
    /** Calls `listener` when the tab is shown or hidden. */
    onVisibilityChange(listener: () => void): void;
    /** Whether the browser believes it has a connection (`navigator.onLine`); `false` is reliable, `true` is not. */
    isOnline(): boolean;
    /** Calls `listener` when the browser loses or regains its connection (`online` and `offline` events). */
    onOnlineChange(listener: () => void): void;
    /**
     * Asks for the Web Lock `name` (`navigator.locks`), shared by the app's tabs: `onAcquired` is called once this
     * tab holds it, which it does until the function returned is called (it also withdraws a request still
     * waiting) or the tab closes. `null` when the browser has no Web Locks.
     */
    requestLock(name: string, onAcquired: () => void): (() => void) | null;
    /** Joins the `BroadcastChannel` `name`; `onMessage` gets what the other tabs post on it. */
    openChannel(name: string, onMessage: (message: unknown) => void): BrowserChannel;
    /** Calls `listener` when the page is closed, frozen or resumed ({@link PageLifecycleEvent}). */
    onPageLifecycle(listener: (event: PageLifecycleEvent) => void): void;
    /**
     * How many bytes the app's origin keeps in this browser — IndexedDB and the storages
     * (`navigator.storage.estimate()`, an estimate); `null` when the browser does not say.
     */
    estimateStorage(): Promise<number | null>;
}

/** The browser the app runs in; `window` unless a test sets another. */
export const Browser = defineInterface<BrowserShape>({
    name: 'Browser',
    default: () => ({
        fetch: (input, init) => window.fetch(input, init),
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
        origin: window.location.origin,
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        navigate: url => {
            window.location.assign(url);
        },
        openInNewTab: url => {
            window.open(url, '_blank', 'noopener,noreferrer');
        },
        onLocalStorageChange: listener => {
            window.addEventListener('storage', event => {
                if (event.storageArea === window.localStorage) {
                    listener(event.key);
                }
            });
        },
        isVisible: () => document.visibilityState === 'visible',
        onVisibilityChange: listener => {
            document.addEventListener('visibilitychange', () => listener());
        },
        isOnline: () => navigator.onLine,
        onOnlineChange: listener => {
            window.addEventListener('online', () => listener());
            window.addEventListener('offline', () => listener());
        },
        requestLock: (name, onAcquired) => {
            // Missing on an insecure origin and in old browsers, whatever the DOM types say.
            if (!('locks' in navigator)) {
                return null;
            }

            const withdrawn = new AbortController();
            let release = () => {};
            const held = new Promise<void>(resolve => {
                release = resolve;
            });
            navigator.locks
                .request(name, { signal: withdrawn.signal }, () => {
                    onAcquired();
                    return held;
                })
                // Withdrawn while it waited (`AbortError`): nothing was held.
                .catch(() => {});

            return () => {
                withdrawn.abort();
                release();
            };
        },
        openChannel: (name, onMessage) => {
            const channel = new BroadcastChannel(name);
            channel.addEventListener('message', event => onMessage(event.data));
            return {
                post: message => channel.postMessage(message),
                close: () => channel.close(),
            };
        },
        onPageLifecycle: listener => {
            window.addEventListener('pagehide', () => listener('pagehide'));
            document.addEventListener('freeze', () => listener('freeze'));
            document.addEventListener('resume', () => listener('resume'));
        },
        estimateStorage: async () => {
            // Missing on an insecure origin, whatever the DOM types say.
            if (!('storage' in navigator)) {
                return null;
            }

            try {
                return (await navigator.storage.estimate()).usage ?? null;
            } catch {
                return null;
            }
        },
    }),
});
