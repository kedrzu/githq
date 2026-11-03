import type { BrowserShape } from '@/services/Browser.js';

/** The connection of a fake browser: what `Browser` says of it, and the test changing it. */
export interface FakeOnline extends Pick<BrowserShape, 'isOnline' | 'onOnlineChange'> {
    /** The browser loses or regains its connection. */
    readonly setOnline: (value: boolean) => void;
}

/**
 * A fake browser's connection, online unless told otherwise.
 *
 * @util
 */
export function fakeOnline(initial = true): FakeOnline {
    const listeners: (() => void)[] = [];
    let online = initial;

    return {
        isOnline: () => online,
        onOnlineChange: listener => {
            listeners.push(listener);
        },
        setOnline,
    };

    function setOnline(value: boolean) {
        online = value;
        for (const listener of listeners) {
            listener();
        }
    }
}
