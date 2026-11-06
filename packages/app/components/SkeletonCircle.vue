<!-- A skeleton's circle, standing in for an icon, an avatar or a dot (a commit, a run): a round `SkeletonBar`, so the band of its `Skeleton` runs through it too. Decorative. -->
<script lang="ts" setup>
import SkeletonBar from './SkeletonBar.vue';

withDefaults(
  defineProps<{
    /** Its diameter in px. It keeps it in a narrow row, where a bar would shrink. */
    size?: number;
    /** `strong` stands in for an icon, `weak` for something quieter. */
    tone?: 'strong' | 'weak';
  }>(),
  { size: 14, tone: 'strong' },
);
</script>

<template>
  <SkeletonBar
    :style="{ flex: 'none' }"
    :width="size"
    :height="size"
    radius="50%"
    :tone="tone"
  />
</template>
