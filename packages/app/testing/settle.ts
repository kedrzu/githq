const realSetImmediate = globalThis.setImmediate;

/** How many event loop turns in a row must schedule nothing before the work counts as done. */
const QUIET_TURNS = 30;

/** Every `setImmediate` asked for so far, which is how IndexedDB's work (fake-indexeddb) moves on. */
let scheduled = 0;

globalThis.setImmediate = Object.assign(
    (...args: Parameters<typeof setImmediate>) => {
        scheduled++;
        return realSetImmediate(...args);
    },
    { __promisify__: realSetImmediate.__promisify__ },
);

/**
 * Lets the promises in flight — fetches, their bodies, IndexedDB — run as far as they can, however many turns of the
 * event loop that takes: it counts turns, not time, so a loaded machine changes nothing. Promises run out between two
 * turns, so a turn that schedules nothing means the chain has ended. Real timers are not waited for.
 */
export async function settle() {
    let quiet = 0;
    while (quiet < QUIET_TURNS) {
        const before = scheduled;
        await new Promise(resolve => {
            realSetImmediate(resolve);
        });
        quiet = scheduled === before ? quiet + 1 : 0;
    }
}
