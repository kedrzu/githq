<!-- A list's row still on its way (first run and loading D8, `Empty / Ghost row`): an icon dot, a title and a meta bar and an age, laid out to the metrics of `ItemRow`, so the row that replaces it lands without a jump. -->
<script lang="ts" setup>
import Skeleton from './Skeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import SkeletonCircle from './SkeletonCircle.vue';

withDefaults(
  defineProps<{
    /** Which row of its set it is, from 0: how late its band starts. */
    row?: number;
    /** In px; a set varies them row by row, the same on every render. */
    titleWidth?: number;
    metaWidth?: number;
  }>(),
  { row: 0, titleWidth: 300, metaWidth: 170 },
);
</script>

<template>
  <Skeleton
    :class="css.ghostRow"
    :row="row"
  >
    <span :class="css.ghostRow_icon">
      <SkeletonCircle :size="14" />
    </span>
    <span :class="css.ghostRow_content">
      <span :class="css.ghostRow_line">
        <SkeletonBar :width="titleWidth" />
        <SkeletonBar
          :class="css.ghostRow_age"
          :width="18"
          :height="8"
          tone="weak"
        />
      </span>
      <span :class="[css.ghostRow_line, css.ghostRow_line_meta]">
        <SkeletonBar
          :width="metaWidth"
          :height="8"
          tone="weak"
        />
      </span>
    </span>
  </Skeleton>
</template>

<style lang="scss" module="css">
// `ItemRow`'s box: its padding and gaps, an icon 15px square 2px down, a title line of 18px and a meta line of 16px.
.ghostRow {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-10 $spacing-16;
}

.ghostRow_icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;
}

.ghostRow_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-5;
  min-width: 0;
}

.ghostRow_line {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: 18px;
  overflow: hidden;
}

.ghostRow_line_meta {
  height: 16px;
}

// At the end of the title's line, as the row's age.
.ghostRow_age {
  margin-left: auto;
}
</style>
