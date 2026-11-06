/** Why it can't be read, as the status bar knows it app-wide, with what the cause's action needs (`CantBeRead`). */
export type CantBeReadCause =
    | { readonly kind: 'offline' }
    /** Refresh paused by GitHub's hourly allowance until `until` (epoch ms). */
    | { readonly kind: 'paused'; readonly until: number }
    /** GitHub fails; `retry` asks again, the button busy until it settles. */
    | { readonly kind: 'failing'; readonly retry: () => Promise<unknown> }
    /** No access or gone, which look the same from GitHub; `url` is its page there. */
    | { readonly kind: 'hidden'; readonly url: string };
