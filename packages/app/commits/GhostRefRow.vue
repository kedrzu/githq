<!-- A branch's or tag's row still on its way (first run and loading D17, `Empty / Ghost ref row`): an icon, a name bar and an age, laid out to the metrics of `CommitRefList`'s rows, so the list that replaces it lands without a jump. -->
<script lang="ts" setup>
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';

withDefaults(
  defineProps<{
    /** Which row of its set it is, from 0: how late its band starts. */
    row?: number;
    /** In px; a set varies them row by row, the same on every render. */
    nameWidth?: number;
  }>(),
  { row: 0, nameWidth: 130 },
);
</script>

<template>
  <Skeleton
    :class="css.ghostRefRow"
    :row="row"
  >
    <SkeletonBar
      :width="12"
      :height="12"
      tone="weak"
    />
    <SkeletonBar
      :width="nameWidth"
      :height="8"
    />
    <SkeletonBar
      :class="css.ghostRefRow_age"
      :width="18"
      :height="8"
      tone="weak"
    />
  </Skeleton>
</template>

<style lang="scss" module="css">
// `CommitRefList`'s row: its padding, margin and gap, and its 16px line.
.ghostRefRow {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-10;
  margin: 0 $spacing-4;
}

// At the end of the row, as the ref's age.
.ghostRefRow_age {
  margin-left: auto;
}
</style>
