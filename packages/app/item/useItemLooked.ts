import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { ItemLookedStore } from '@/store/ItemLookedStore.js';

import { getThreadNewestAt } from './thread/buildThread.js';
import type { BuildThreadParams } from './thread/buildThread.js';

/** Options of {@link useItemLooked}. */
export interface UseItemLookedOptions {
    /** The opened item's id; `null` until found. */
    id: MaybeRefOrGetter<string | null>;
    /** What its thread is built from, as shown; `null` while none of it shows. */
    thread: MaybeRefOrGetter<BuildThreadParams | null>;
}

/**
 * When the user last looked at the opened item before this time (epoch ms, `ItemLookedStore`), for its thread's
 * "N new since you looked" line (F5) — read once as it opens, so the line stays until they leave; `null` until read, and
 * when they never looked at it on this device. Leaving it — another item opened, the item closed, the tab hidden or
 * left — keeps the newest item of its thread they saw as the next time's.
 */
export function useItemLooked(options: UseItemLookedOptions): Readonly<Ref<number | null>> {
    const looked = useService(ItemLookedStore);
    const lookedAt = shallowRef<number | null>(null);
    /** The item shown and what its thread was built from, as long as it is. */
    let shown: Shown | null = null;
    /** The time was read for the item shown: from then on the tab hidden counts as leaving. */
    let timeRead = false;

    watch(
        () => [toValue(options.id), toValue(options.thread)] as const,
        ([id, thread], before) => {
            if (id !== before?.[0]) {
                leave();
                lookedAt.value = null;
                timeRead = false;
                if (id !== null) {
                    void readLooked(id);
                }
            }

            shown = id !== null && thread ? { id, thread } : shown?.id === id ? shown : null;
        },
        { immediate: true },
    );

    onWindowEvent('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && timeRead) {
            markShown();
        }
    });
    onWindowEvent('pagehide', markShown);
    onScopeDispose(leave);

    return lookedAt;

    async function readLooked(id: string) {
        const at = await looked.read(id);
        if (toValue(options.id) === id) {
            lookedAt.value = at;
            timeRead = true;
        }
    }

    function leave() {
        markShown();
        shown = null;
    }

    function markShown() {
        if (!shown) {
            return;
        }

        const newest = getThreadNewestAt(shown.thread);
        if (newest !== null) {
            looked.mark(shown.id, newest);
        }
    }
}

/** An item whose thread shows, and what it is built from. */
interface Shown {
    readonly id: string;
    readonly thread: BuildThreadParams;
}
