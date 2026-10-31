import type { BrowserShape, PageLifecycleEvent } from '@/services/Browser.js';

/** What one tab of {@link createTestTabs} gives its `Browser`, and what a test does to the tab. */
export interface TestTab extends Pick<BrowserShape, 'requestLock' | 'openChannel' | 'onPageLifecycle'> {
    /** The tab is closed: `pagehide`, then its locks are given up and its channels closed, as the browser does. */
    close(): void;
    /** The tab is gone without a word — it crashed, or the browser discarded it: no `pagehide`, the rest as `close`. */
    crash(): void;
    /** The browser freezes the tab (`freeze`) or lets it run again (`resume`). */
    lifecycle(event: PageLifecycleEvent): void;
}

/** One browser's tabs of the app, sharing its Web Locks and broadcast channels ({@link createTestTabs}). */
export interface TestTabs {
    /** A new tab. */
    open(): TestTab;
}

interface LockRequest {
    readonly tab: object;
    readonly onAcquired: () => void;
    released: boolean;
}

interface ChannelMember {
    readonly tab: object;
    readonly name: string;
    readonly onMessage: (message: unknown) => void;
    open: boolean;
}

/**
 * The Web Locks and `BroadcastChannel`s of one browser, for tests running several tabs of the app in one process,
 * each its own container: a lock goes to one tab at a time, in the order they asked, and is granted a moment
 * later (as `navigator.locks` calls back); a message reaches every other tab on the channel a moment later,
 * structured-cloned — what could not cross between real tabs throws here too.
 */
export function createTestTabs(): TestTabs {
    const locks = new Map<string, LockRequest[]>();
    const members: ChannelMember[] = [];

    return { open };

    function open(): TestTab {
        const tab = {};
        const lifecycleListeners: ((event: PageLifecycleEvent) => void)[] = [];

        return {
            requestLock(name, onAcquired) {
                const request: LockRequest = { tab, onAcquired, released: false };
                const queue = locks.get(name) ?? [];
                queue.push(request);
                locks.set(name, queue);
                if (queue.length === 1) {
                    grant(request);
                }

                return () => release(name, request);
            },
            openChannel(name, onMessage) {
                const member: ChannelMember = { tab, name, onMessage, open: true };
                members.push(member);
                return {
                    post(message) {
                        if (!member.open) {
                            throw new Error('The channel is closed');
                        }

                        const cloned: unknown = structuredClone(message);
                        for (const other of members) {
                            if (other !== member && other.name === name && other.open) {
                                queueMicrotask(() => {
                                    if (other.open) {
                                        other.onMessage(structuredClone(cloned));
                                    }
                                });
                            }
                        }
                    },
                    close() {
                        member.open = false;
                    },
                };
            },
            onPageLifecycle(listener) {
                lifecycleListeners.push(listener);
            },
            close() {
                for (const listener of lifecycleListeners) {
                    listener('pagehide');
                }

                end();
            },
            crash: end,
            lifecycle(event) {
                for (const listener of lifecycleListeners) {
                    listener(event);
                }
            },
        };

        function end() {
            for (const [name, queue] of locks) {
                for (const request of queue.filter(other => other.tab === tab)) {
                    release(name, request);
                }
            }

            for (const member of members) {
                if (member.tab === tab) {
                    member.open = false;
                }
            }
        }
    }

    function grant(request: LockRequest) {
        queueMicrotask(() => {
            if (!request.released) {
                request.onAcquired();
            }
        });
    }

    function release(name: string, request: LockRequest) {
        if (request.released) {
            return;
        }

        request.released = true;
        const queue = locks.get(name) ?? [];
        const wasHolder = queue[0] === request;
        const left = queue.filter(other => other !== request);
        locks.set(name, left);
        const next = left[0];
        if (wasHolder && next) {
            grant(next);
        }
    }
}
