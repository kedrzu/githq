<!-- A skeleton's wrapper: holds the rhythm of the shapes inside it (D9) — one band crossing all of them at once, never each on its own — and how late its row starts. Decorative: hidden from assistive technology. -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Which row of a set it is, from 0: each row's band starts `$skeleton-row-stagger` after the one above. */
    row?: number;
  }>(),
  { row: 0 },
);

defineSlots<{
  /** The shapes: `SkeletonBar`, `SkeletonCircle`, laid out as what they stand in for. */
  default(): unknown;
}>();

const root = useTemplateRef<HTMLElement>('root');
let observer: ResizeObserver | undefined;

// The observer's first call comes before the first paint, so no band is ever drawn out of place; the wrapper resizing
// calls it again. Its shapes are found by their `data-skeleton-shape`; no wrapper is nested in another.
onMounted(() => {
  observer = new ResizeObserver(measure);
  if (root.value) {
    observer.observe(root.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());

function measure() {
  const element = root.value;
  if (!element) {
    return;
  }

  const span = element.getBoundingClientRect();
  element.style.setProperty('--skeleton-span', `${span.width}px`);
  element.style.setProperty('--skeleton-travel', `${-1.5 * span.width}px`);
  for (const shape of element.querySelectorAll<HTMLElement>('[data-skeleton-shape]')) {
    shape.style.setProperty('--skeleton-x', `${shape.getBoundingClientRect().left - span.left}px`);
  }
}
</script>

<template>
  <div
    ref="root"
    aria-hidden="true"
    :style="{ '--skeleton-row': props.row }"
  >
    <slot />
  </div>
</template>
