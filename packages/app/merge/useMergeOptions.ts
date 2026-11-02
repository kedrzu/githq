import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { ref, shallowRef, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { MergeOptions } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

/** What {@link useMergeOptions} reads the options of. */
export interface UseMergeOptionsOptions {
    /** The pull request the merge panel is open for; `null` while it is closed. */
    readonly itemId: MaybeRefOrGetter<string | null>;
}

/** The merge panel's options as they are being read. */
export interface MergeOptionsViewModel {
    /** `null` until read, and when they could not be. */
    readonly options: MergeOptions | null;
    readonly reading: boolean;
}

/**
 * The merge options of the pull request the merge panel is open for, read fresh each time it opens for one
 * ({@link PullRequestMerger}); kept only while the panel is open.
 */
export function useMergeOptions(options: UseMergeOptionsOptions): MergeOptionsViewModel {
    const merger = useService(PullRequestMerger);
    const itemId = makeRef(options.itemId);
    const read = shallowRef<MergeOptions | null>(null);
    const reading = ref(false);
    let latest = 0;

    watch(itemId, id => void load(id), { immediate: true });

    return reactive({ options: read, reading });

    async function load(id: string | null) {
        const attempt = ++latest;
        read.value = null;
        reading.value = id !== null;
        if (id === null) {
            return;
        }

        const answer = await merger.readOptions(id);
        // Opened for another meanwhile: its own read decides.
        if (attempt === latest) {
            read.value = answer;
            reading.value = false;
        }
    }
}
