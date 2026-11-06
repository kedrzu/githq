<!-- A workflow's row still on its way (first run and loading D17, `Empty / Ghost workflow row`): a state dot, a name bar, the repository on the cross-repository screen, the ref, a strip of five runs, the standing and the last result, laid out to the metrics of `WorkflowRow`, so the row that replaces it lands without a jump. -->
<script lang="ts" setup>
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import SkeletonCircle from '@/components/SkeletonCircle.vue';

withDefaults(
  defineProps<{
    /** Which row of its set it is, from 0: how late its band starts. */
    row?: number;
    /** Whether it has the repository's column, as on the cross-repository screen. */
    repository?: boolean;
  }>(),
  { row: 0, repository: false },
);

/** `RunStrip`'s five ticks. */
const RUNS = 5;
</script>

<template>
  <Skeleton
    :class="css.ghostWorkflowRow"
    :row="row"
  >
    <span :class="css.ghostWorkflowRow_icon">
      <SkeletonCircle :size="14" />
    </span>
    <span :class="css.ghostWorkflowRow_name">
      <SkeletonBar
        :width="120"
        :height="9"
      />
    </span>
    <span
      v-if="repository"
      :class="css.ghostWorkflowRow_repository"
    >
      <SkeletonBar
        :width="90"
        :height="8"
        tone="weak"
      />
    </span>
    <span :class="css.ghostWorkflowRow_ref">
      <SkeletonBar
        :width="60"
        :height="8"
        tone="weak"
      />
    </span>
    <span :class="css.ghostWorkflowRow_runs">
      <SkeletonBar
        v-for="run in RUNS"
        :key="run"
        :width="7"
        :height="10"
        :radius="1"
      />
    </span>
    <span :class="css.ghostWorkflowRow_status">
      <SkeletonBar
        :width="150"
        :height="8"
        tone="weak"
      />
    </span>
    <SkeletonBar
      :width="70"
      :height="8"
      tone="weak"
    />
  </Skeleton>
</template>

<style lang="scss" module="css">
// `WorkflowRow`'s box: its height, padding and gap, an icon 15px square, and its columns' widths.
.ghostWorkflowRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: $workflow-row-height;
  padding: 0 $spacing-16;
}

.ghostWorkflowRow_icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
}

.ghostWorkflowRow_name {
  display: flex;
  flex: none;
  width: $workflow-name-width;
  min-width: 0;
}

.ghostWorkflowRow_repository {
  display: flex;
  flex: none;
  width: $workflow-repository-width;
}

.ghostWorkflowRow_ref {
  display: flex;
  flex: none;
  width: $workflow-ref-width;
}

// `RunStrip`'s ticks: 7px wide, 3px apart, bottom-aligned in 14px.
.ghostWorkflowRow_runs {
  display: flex;
  flex: none;
  gap: 3px;
  align-items: flex-end;
  height: 14px;
}

.ghostWorkflowRow_status {
  display: flex;
  flex: 1;
  min-width: 0;
  padding-left: $spacing-10;
}
</style>
