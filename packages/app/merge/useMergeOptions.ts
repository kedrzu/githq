import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { ref, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { MergeOptions } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

/** What {@link useMergeOptions} reads the options of. */
export interface UseMergeOptionsOptions {
    /** The pull request to read them of: the one the merge panel is open for; `null` for none. */
    readonly itemId: MaybeRefOrGetter<string | null>;
    /**
     * Whatever its change means the read went old (the row's check counts): read again, the old options staying until
     * the new ones arrive. Read once otherwise.
     */
    readonly readAgainOn?: MaybeRefOrGetter<unknown>;
}

/** A pull request's merge options as they are being read. */
export interface MergeOptionsViewModel {
    /** `null` until read, and when they could not be. */
    readonly options: MergeOptions | null;
    readonly reading: boolean;
    /**
     * Reads them again, the old ones staying until the new ones arrive (a step the panel took changed them):
     * resolves once read, or once another read took its place.
     */
    refresh(): Promise<void>;
}

/**
 * The merge options of a pull request ({@link PullRequestMerger}), read fresh each time it is asked for one — the
 * merge panel as it opens, the opened item for which of its checks are required; kept only while asked.
 */
export function useMergeOptions(options: UseMergeOptionsOptions): MergeOptionsViewModel {
    const merger = useService(PullRequestMerger);
    const itemId = makeRef(options.itemId);
    const read = shallowRef<MergeOptions | null>(null);
    const reading = ref(false);
    let latest = 0;

    watch(
        [itemId, () => toValue(options.readAgainOn)],
        ([id], previous) => {
            // Another pull request: nothing of the last one's read shows meanwhile.
            if (id !== previous?.[0]) {
                read.value = null;
            }

            void load(id);
        },
        { immediate: true },
    );

    return reactive<MergeOptionsViewModel>({ options: read, reading, refresh: () => load(itemId.value) });

    async function load(id: string | null) {
        const attempt = ++latest;
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
