<!-- A skeleton's wrapper: holds the rhythm of the shapes inside it (D9) — one band crossing all of them at once, never each on its own — and how late its row starts. Decorative: hidden from assistive technology. -->
<script lang="ts" setup>
import { provideContext } from '@nzyme/vue-utils/context.js';
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

import { SkeletonContext } from './SkeletonContext.js';

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
const shapes = new Set<HTMLElement>();
let observer: ResizeObserver | undefined;

provideContext(SkeletonContext, {
  add: shape => {
    shapes.add(shape);
    observer?.observe(shape);
  },
  remove: shape => {
    shapes.delete(shape);
    observer?.unobserve(shape);
  },
});

// The shapes mounted first: they wait in `shapes` until there is an observer. Its first call comes before the first
// paint, so no band is ever drawn out of place; a shape that resizes moves its neighbours and calls it again.
onMounted(() => {
  observer = new ResizeObserver(measure);
  if (root.value) {
    observer.observe(root.value);
  }
  for (const shape of shapes) {
    observer.observe(shape);
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
  for (const shape of shapes) {
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
