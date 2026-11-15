import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

/**
 * Whether a row's repository (`owner/name`) is among the tracked ones a list's page passes down: a phone's row names it
 * without its owner (mobile D23).
 */
export function useRepositoryTracked(repositories: MaybeRefOrGetter<readonly string[]>) {
    const tracked = computed(() => new Set(toValue(repositories)));

    return isTracked;

    function isTracked(nameWithOwner: string | undefined) {
        return nameWithOwner !== undefined && tracked.value.has(nameWithOwner);
    }
}
