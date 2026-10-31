import { parseJson } from '@githq/github/utils/parseJson.js';

import type { BrowserShape } from '@/services/Browser.js';

import type { AccountSession } from './AccountSession.js';

/** Where {@link createAccountSlot} keeps its value and what it does with it. */
export interface AccountSlotOptions<T> {
    readonly accounts: AccountSession;
    readonly browser: BrowserShape;
    /** The key's start; the user's login ends it (`githq.newIssue.<login>`). */
    readonly keyPrefix: string;
    /** The value kept, from its parsed JSON — anything, `undefined` when none or not JSON: what is not understood is left out. */
    parse(stored: unknown): T;
    /** Another user signed in — with the value kept for them — or none (`null`); also at once, for who is signed in now. */
    follow(value: T | null): void;
}

/** A value kept for the signed-in user (see {@link createAccountSlot}). */
export interface AccountSlot<T> {
    /** Keeps the value for the user signed in now; nothing when none is. */
    save(value: T): void;
    /**
     * The value kept for the user signed in now, read again — another tab may have changed it since; `null` when
     * none is signed in.
     */
    read(): T | null;
}

/**
 * A JSON value kept in this browser's `localStorage` per user, read back when they sign in and deleted when they
 * sign out — through `Browser`, so tests drive it.
 *
 * @util
 */
export function createAccountSlot<T>(options: AccountSlotOptions<T>): AccountSlot<T> {
    const { accounts, browser, keyPrefix } = options;
    let login: string | null = null;

    accounts.onChange(account => {
        const next = account?.login ?? null;
        if (next === login) {
            return;
        }

        if (login !== null && next === null) {
            browser.localStorage.removeItem(keyPrefix + login);
        }

        login = next;
        options.follow(read());
    });

    return { save, read };

    function read() {
        return login === null ? null : options.parse(parseJson(browser.localStorage.getItem(keyPrefix + login)));
    }

    function save(value: T) {
        if (login !== null) {
            browser.localStorage.setItem(keyPrefix + login, JSON.stringify(value));
        }
    }
}
