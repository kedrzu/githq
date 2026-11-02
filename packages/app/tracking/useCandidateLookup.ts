import { ref, shallowRef, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';

import type { CandidateProject, CandidateRepository } from './TrackingTypes.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

/** How long what is named must stay as it is before it is looked up. */
const LOOKUP_DELAY_MS = 300;

/** What {@link useCandidateLookup} looks up, and with what. */
export interface UseCandidateLookupOptions<T> {
    /** What the filter names now; `null` while nothing is to be looked up. */
    readonly reference: () => TrackingReference | null;
    /** Looks a repository or project up on GitHub (`TrackingStore.findCandidate`). */
    readonly find: (reference: TrackingReference) => Promise<CandidateProject | CandidateRepository | null>;
    /** What of the answer the picker offers: a repository in the repository picker, a project in the project one. */
    readonly accept: (candidate: CandidateProject | CandidateRepository) => T | null;
}

/** What a picker's filter named and found. */
export interface CandidateLookup<T> {
    /** What was found; `null` while looking, or when nothing was. */
    readonly lookedUp: Readonly<ShallowRef<T | null>>;
    readonly lookingUp: Readonly<Ref<boolean>>;
}

/**
 * The pickers' look-up (T18, T22): what the filter names by its address, once nothing listed matches it, is looked up
 * on GitHub after a short pause. Latest wins: a change cancels the wait, and what was asked before it is dropped when
 * it answers.
 * @util
 */
export function useCandidateLookup<T>(options: UseCandidateLookupOptions<T>): CandidateLookup<T> {
    const lookedUp = shallowRef<T | null>(null);
    const lookingUp = ref(false);

    watch(
        options.reference,
        (named, _before, onCleanup) => {
            lookedUp.value = null;
            lookingUp.value = named !== null;
            if (!named) {
                return;
            }

            let stale = false;
            const timer = setTimeout(() => void lookUp(named, () => stale), LOOKUP_DELAY_MS);
            onCleanup(() => {
                stale = true;
                clearTimeout(timer);
            });
        },
        { immediate: true },
    );

    return { lookedUp, lookingUp };

    async function lookUp(named: TrackingReference, isStale: () => boolean) {
        const candidate = await options.find(named);
        if (!isStale()) {
            lookedUp.value = candidate ? options.accept(candidate) : null;
            lookingUp.value = false;
        }
    }
}
