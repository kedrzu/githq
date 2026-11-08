<!-- A board's card still on its way (first run and loading D8, `Empty / Ghost card`): a meta bar over two title bars, in tones lifted for the card's own surface. -->
<script lang="ts" setup>
import Skeleton from './Skeleton.vue';
import SkeletonBar from './SkeletonBar.vue';

withDefaults(
  defineProps<{
    /** Which card of its column it is, from 0: how late its band starts. */
    row?: number;
  }>(),
  { row: 0 },
);
</script>

<template>
  <Skeleton
    :class="css.ghostCard"
    :row="row"
  >
    <SkeletonBar
      :width="90"
      :height="8"
      tone="weak"
    />
    <SkeletonBar :width="200" />
    <SkeletonBar :width="130" />
  </Skeleton>
</template>

<style lang="scss" module="css">
// The card of a board (`ListView`): its border and radius, its fill more faint.
.ghostCard {
  --skeleton-strong: #{$color-skeleton-card-strong};
  --skeleton-strong-highlight: #{$color-skeleton-card-strong-highlight};
  --skeleton-weak: #{$color-skeleton-card-weak};
  --skeleton-weak-highlight: #{$color-skeleton-card-weak-highlight};

  display: flex;
  flex-direction: column;
  gap: $spacing-9;
  padding: $spacing-12;
  background: $color-skeleton-card;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}
</style>
