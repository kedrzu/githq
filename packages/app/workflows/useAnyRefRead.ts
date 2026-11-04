import { useService } from '@nzyme/vue-ioc/useService.js';
import { toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { SyncEngine } from '@/sync/SyncEngine.js';

/**
 * Keeps the repository's workflows' runs on any ref (actions D2, D7) read for as long as the calling component is
 * mounted: every poll asks them, at once as it mounts, in whichever tab; another repository named takes its place.
 * @util
 */
export function useAnyRefRead(nameWithOwner: MaybeRefOrGetter<string>) {
    const sync = useService(SyncEngine);

    watch(
        () => toValue(nameWithOwner),
        (name, _previous, onCleanup) => {
            onCleanup(sync.watchAnyRef(name));
        },
        { immediate: true },
    );
}
