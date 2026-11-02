import { createContainer } from '@nzyme/vue-ioc/createContainer.js';

import { VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';

/**
 * For a component spec in a browser (`createTestSession()` runs under `bun test`): the browser with a user of their own
 * signed in, keeping nothing between tests, and a GitHub answering with `fetch` — every request a 502 without it.
 *
 * @util
 */
export function createSignedInBrowser(fetch?: BrowserShape['fetch']): BrowserShape {
    const login = `user-${crypto.randomUUID()}`;
    const stored = new Map([
        [TOKEN_KEY, `gho_${login}`],
        [VIEWER_KEY, JSON.stringify({ login, name: null, avatarUrl: 'https://avatars.test/user' })],
    ]);
    return {
        ...createContainer().resolve(Browser),
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem: (key, value) => {
                stored.set(key, value);
            },
            removeItem: key => {
                stored.delete(key);
            },
            key: index => [...stored.keys()][index] ?? null,
            get length() {
                return stored.size;
            },
        },
        writeCookie: () => {},
        fetch: fetch ?? (() => Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 }))),
    };
}
