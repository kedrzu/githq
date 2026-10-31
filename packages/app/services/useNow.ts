import { useService } from '@nzyme/vue-ioc/useService.js';
import { onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { Clock } from './Clock.js';

/**
 * The time (epoch ms) from the app's {@link Clock}, moved on every `intervalMs` while `active` — always when not
 * given — and the component lives: what "checked 14s ago" and a row's age are counted to.
 *
 * @util
 */
export function useNow(intervalMs: number, active: MaybeRefOrGetter<boolean> = true): Readonly<Ref<number>> {
    const clock = useService(Clock);
    const now = shallowRef(clock.now());
    let cancelTick: (() => void) | null = null;

    watch(
        () => toValue(active),
        ticking => {
            cancelTick?.();
            cancelTick = null;
            if (ticking) {
                tick();
            }
        },
        { immediate: true },
    );
    onScopeDispose(() => cancelTick?.());

    return now;

    function tick() {
        now.value = clock.now();
        cancelTick = clock.schedule(tick, intervalMs);
    }
}
