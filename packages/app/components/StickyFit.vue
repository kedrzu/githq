<!-- Content that stays in view while its scroller scrolls: stuck to the top while it fits the scroller, and when it is taller, scrolled with the rest until its bottom meets the scroller's bottom, then kept there. Its insets are the content's own padding. -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

defineSlots<{
  /** What stays in view. */
  default(): unknown;
}>();

const root = useTemplateRef<HTMLElement>('root');
let observer: ResizeObserver | undefined;

// The content and the scroller each resizing can make it fit or no longer fit: one observer for both, whose first call
// comes before the first paint. Until then it sticks to the top.
onMounted(() => {
  const element = root.value;
  if (!element) {
    return;
  }

  const scroller = findScroller(element);
  if (!scroller) {
    return;
  }

  observer = new ResizeObserver(() => {
    element.style.top = `${Math.min(0, scroller.clientHeight - element.offsetHeight)}px`;
  });
  observer.observe(element);
  observer.observe(scroller);
});

onBeforeUnmount(() => observer?.disconnect());

/** The nearest ancestor that scrolls vertically, whether or not it overflows yet. */
function findScroller(element: HTMLElement) {
  for (let current = element.parentElement; current; current = current.parentElement) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
  }

  return null;
}
</script>

<template>
  <div
    ref="root"
    :class="css.stickyFit"
  >
    <slot />
  </div>
</template>

<style lang="scss" module="css">
.stickyFit {
  position: sticky;
  top: 0;
}
</style>
