<!-- A board's column still on its way, its name not known yet (first run and loading D17, `Empty / Ghost column`): a head of an icon dot and a name bar over three ghost cards fading down, in the box of a board's column (`ListView`). -->
<script lang="ts">
const CARD_OPACITIES = [1, 0.75, 0.5];
</script>

<script lang="ts" setup>
import GhostCard from './GhostCard.vue';
import Skeleton from './Skeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonCircle from './SkeletonCircle.vue';

withDefaults(
  defineProps<{
    /** The name bar's width in px; a set varies it column by column, the same on every render. */
    nameWidth?: number;
  }>(),
  { nameWidth: 70 },
);
</script>

<template>
  <div :class="css.ghostColumn">
    <Skeleton :class="css.ghostColumn_head">
      <SkeletonCircle :size="12" />
      <SkeletonBar
        :width="nameWidth"
        :height="9"
      />
    </Skeleton>
    <GhostCard
      v-for="(opacity, index) in CARD_OPACITIES"
      :key="index"
      :row="index + 1"
      :style="{ opacity }"
    />
  </div>
</template>

<style lang="scss" module="css">
// A board's column (`ListView`): its width, padding, gap, fill and radius.
.ghostColumn {
  @include board-column;
}

// The column's head: its padding and gap, a line of its name's height.
.ghostColumn_head {
  @include board-column-head;

  height: 18px;
  padding: $spacing-4 $spacing-6 $spacing-6;
  box-sizing: content-box;
}
</style>
