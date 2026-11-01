import { computed, onBeforeUnmount, onMounted, ref, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import { prefersReducedMotion } from './prefersReducedMotion.js';

/**
 * A landing section's reveal, as its `data-reveal` attribute: `waiting` — below the viewport, its parts hidden
 * (the `landing-reveal` mixin) —, then `revealed` once it scrolls into view.
 */
export type RevealState = 'waiting' | 'revealed';

/**
 * Reveals a landing section the first time it scrolls into view, once — never again on scroll-back. Bind the
 * result to the section's `data-reveal` and give its parts the `landing-reveal` mixin.
 *
 * The prerendered page has no state, so without JavaScript every section is visible. After mount only a section
 * still below the viewport waits, so a section already in view never blinks; under `prefers-reduced-motion:
 * reduce` none does.
 */
export function useReveal(element: MaybeRefOrGetter<HTMLElement | null>): ComputedRef<RevealState | undefined> {
    const state = ref<RevealState>();
    let observer: IntersectionObserver | undefined;

    onMounted(() => {
        const section = toValue(element);
        if (!section || prefersReducedMotion() || section.getBoundingClientRect().top < window.innerHeight) {
            return;
        }

        state.value = 'waiting';
        observer = new IntersectionObserver(reveal);
        observer.observe(section);
    });

    onBeforeUnmount(() => observer?.disconnect());

    return computed(() => state.value);

    function reveal(entries: IntersectionObserverEntry[]) {
        if (!entries.some(entry => entry.isIntersecting)) {
            return;
        }

        state.value = 'revealed';
        observer?.disconnect();
    }
}
