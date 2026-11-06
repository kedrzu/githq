import { useService } from '@nzyme/vue-ioc/useService.js';
import { watch } from 'vue';

import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import { Clock } from '@/services/Clock.js';

/** How often GitHub failing is asked again, as the note says (first run and loading D12). */
const FAILING_RETRY_MS = 30_000;

/** Options of {@link useCantBeReadRetry}. */
export interface UseCantBeReadRetryOptions {
    /** What stands in the way now, when anything does. */
    cause: () => CantBeReadCause | null;
    retry: () => Promise<unknown>;
}

/**
 * Keeps a `CantBeRead` note's word on a surface no poll of its own reads at that pace: GitHub failing is asked again
 * every 30 seconds, a paused read when the allowance comes back (first run and loading D12). Offline needs no timer:
 * the connection coming back is what reads it.
 * @util
 */
export function useCantBeReadRetry({ cause, retry }: UseCantBeReadRetryOptions): void {
    const clock = useService(Clock);

    watch(
        [
            () => cause()?.kind === 'failing',
            () => {
                const current = cause();
                return current?.kind === 'paused' ? current.until : null;
            },
        ],
        ([failing, until], _previous, onCleanup) => {
            if (failing) {
                onCleanup(repeat());
            } else if (until !== null) {
                onCleanup(clock.schedule(() => void retry(), Math.max(0, until - clock.now())));
            }
        },
        { immediate: true },
    );

    /** Asks again every {@link FAILING_RETRY_MS}; the function returned stops it. */
    function repeat() {
        let cancel = clock.schedule(askAgain, FAILING_RETRY_MS);
        return () => cancel();

        function askAgain() {
            void retry();
            cancel = clock.schedule(askAgain, FAILING_RETRY_MS);
        }
    }
}
