import type { TabMessage } from './TabChannel.js';

/** What a store's session receives the other tabs' changes through ({@link createTabInbox}). */
export interface TabInbox {
    /** Takes in another tab's change now, or once the kept copy is in memory. */
    deliver(message: TabMessage): void;
    /** The kept copy is in memory: what was held is taken in over it, in order, and what comes later at once. */
    open(): void;
}

/**
 * The other tabs' changes for a store that reads its kept copy when the user signs in: what arrives before the copy
 * is in memory is held and taken in over it once it is — it is newer than what the copy holds.
 *
 * @util
 */
export function createTabInbox(takeIn: (message: TabMessage) => void): TabInbox {
    let held: TabMessage[] | null = [];

    return { deliver, open };

    function deliver(message: TabMessage) {
        if (held) {
            held.push(message);
        } else {
            takeIn(message);
        }
    }

    function open() {
        const messages = held ?? [];
        held = null;
        for (const message of messages) {
            takeIn(message);
        }
    }
}
