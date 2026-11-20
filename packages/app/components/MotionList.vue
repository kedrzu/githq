<!-- A list whose items fade in as they come, fade out as they go and slide into place as the rest move, while the app's animations play (`useMotion`); otherwise a plain list, changing at once. The items are its slot, keyed; class, attributes and listeners go to the list element. Keyed by what it shows, a list showing something else starts over rather than fading one into the other. -->
<script lang="ts" setup>
import TransitionList from '@nzyme/vue-transitions/TransitionList.vue';

import { useMotion } from '@/utils/useMotion.js';

const props = withDefaults(
  defineProps<{
    /** The list element. */
    tag?: string;
  }>(),
  { tag: 'ul' },
);

// Its length is `--transition-list-duration` (`styles/main.scss`).
const motion = useMotion();

/**
 * An item going fades out of the flow (`TransitionList` makes it `position: absolute`): it keeps its width rather than
 * shrinking to its content, and while it fades it is no longer there for a click, the keyboard or assistive
 * technology, nor the current one.
 */
function holdLeaving(el: Element) {
  if (el instanceof HTMLElement) {
    el.style.boxSizing = 'border-box';
    el.style.width = `${el.getBoundingClientRect().width}px`;
    el.inert = true;
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('aria-current');
  }
}
</script>

<template>
  <TransitionList
    v-if="motion"
    :tag="props.tag"
    @before-leave="holdLeaving"
  >
    <slot />
  </TransitionList>
  <component
    :is="props.tag"
    v-else
  >
    <slot />
  </component>
</template>
