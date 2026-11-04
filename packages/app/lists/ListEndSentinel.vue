<!-- What says a list has reached its end (`ListView`'s `end` slot), ahead of the end coming into view so that reaching the last row with `j` is enough, and showing what the owner puts in. An observer speaks only as the sentinel crosses that line, so it is asked anew when `position` moves: a page that left the end in reach goes on, and one that moved nothing — refused, say — asks nothing more. -->
<script lang="ts" setup>
import { useIntersectionObserver } from '@nzyme/vue-utils/useIntersectionObserver.js';
import { useTemplateRef, watch } from 'vue';

const props = defineProps<{
  /** How far the list is read: seen to move, the end is looked for again. */
  position: string;
}>();

const emit = defineEmits<{
  /** The end is in reach. */
  reach: [];
}>();

defineSlots<{
  /** Said under the last row, in the room kept for it. */
  default?(): unknown;
}>();

/** How far ahead of the view the end counts as reached: about ten rows, so a read starts before the user arrives. */
const READ_AHEAD_PX = 400;

const element = useTemplateRef<HTMLElement>('element');
const visibility = useIntersectionObserver({
  element,
  // Its parent is what scrolls: only against that element does the margin reach beyond what is clipped.
  options: () => ({ root: element.value?.parentElement, rootMargin: `0px 0px ${READ_AHEAD_PX}px 0px` }),
  onVisible: () => emit('reach'),
});

watch(
  () => props.position,
  () => {
    if (element.value) {
      visibility.unobserve(element.value);
      visibility.observe(element.value);
    }
  },
  { flush: 'post' },
);
</script>

<template>
  <div
    ref="element"
    :class="css.listEndSentinel"
    role="status"
  >
    <slot />
  </div>
</template>

<style lang="scss" module="css">
.listEndSentinel {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 $spacing-16 0 40px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}
</style>
