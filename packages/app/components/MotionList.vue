<!-- A list whose items fade in as they come, fade out as they go and slide into place as the rest move, while the app's animations play (`useMotion`); otherwise a plain list, changing at once. The items are its slot, keyed; class, attributes and listeners go to the list element. -->
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
 * shrinking to its content, and takes no clicks while it fades.
 */
function holdLeaving(el: Element) {
  if (el instanceof HTMLElement) {
    el.style.boxSizing = 'border-box';
    el.style.width = `${el.getBoundingClientRect().width}px`;
    el.style.pointerEvents = 'none';
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
