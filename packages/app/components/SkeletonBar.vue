<!-- A skeleton's bar, standing in for a line of text or any block on its way: a fill in its tone, which the band of its `Skeleton` runs through (D9). Decorative. -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

import { anchorSkeletonAnimations } from './skeletonClock.js';
import { SkeletonContext } from './SkeletonContext.js';

const props = withDefaults(
  defineProps<{
    /** In px, or any CSS width ("60%"). It never grows past its container: a long bar shrinks in a narrow pane. */
    width?: number | string;
    /** In px. */
    height?: number;
    /** In px, or any CSS radius; `$radius-skeleton` when left out. */
    radius?: number | string;
    /** `strong` stands in for a title or an icon, `weak` for meta or an age. */
    tone?: 'strong' | 'weak';
  }>(),
  { width: '100%', height: 10, radius: undefined, tone: 'strong' },
);

const element = useTemplateRef<HTMLElement>('element');
const skeleton = injectContext(SkeletonContext, { optional: true });

const style = computed(() => ({
  width: toLength(props.width),
  height: `${props.height}px`,
  borderRadius: props.radius == null ? undefined : toLength(props.radius),
}));

onMounted(() => {
  if (element.value) {
    skeleton?.add(element.value);
    anchorSkeletonAnimations(element.value);
  }
});

onBeforeUnmount(() => {
  if (element.value) {
    skeleton?.remove(element.value);
  }
});

function toLength(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value;
}
</script>

<template>
  <span
    ref="element"
    :class="[css.skeletonBar, css[`skeletonBar_${tone}`]]"
    :style="style"
    aria-hidden="true"
  />
</template>

<style lang="scss" module="css">
.skeletonBar {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  border-radius: $radius-skeleton;
}

.skeletonBar_strong {
  @include skeleton-fill(strong);
}

.skeletonBar_weak {
  @include skeleton-fill(weak);
}
</style>
