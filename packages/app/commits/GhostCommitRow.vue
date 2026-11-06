<!-- A commit's row still on its way (first run and loading D17, `Empty / Ghost commit row`): a lane with a commit's dot on the graph's first lane, a message bar, the author's avatar and name and the age, laid out to the metrics of `CommitRow`, so the row that replaces it lands without a jump. The graph is `--commit-graph-width` wide, as the real rows' is; a narrow row drops the name, as theirs does. -->
<script lang="ts" setup>
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import SkeletonCircle from '@/components/SkeletonCircle.vue';

import { COMMIT_ROW_HEIGHT } from './CommitRow.vue';
import { COMMIT_GRAPH_LANE_WIDTH, COMMIT_GRAPH_PADDING } from './fitCommitGraph.js';

withDefaults(
  defineProps<{
    /** Which row of its set it is, from 0: how late its band starts. */
    row?: number;
    /** In px; a set varies them row by row, the same on every render. */
    messageWidth?: number;
    authorWidth?: number;
  }>(),
  { row: 0, messageWidth: 320, authorWidth: 80 },
);

/** The middle of the graph's first lane, where the default branch's dots are drawn (`CommitGraphCell`). */
const FIRST_LANE_X = COMMIT_GRAPH_PADDING + COMMIT_GRAPH_LANE_WIDTH / 2;
</script>

<template>
  <Skeleton
    :class="css.ghostCommitRow"
    :style="{ height: `${COMMIT_ROW_HEIGHT}px` }"
    :row="row"
  >
    <span
      :class="css.ghostCommitRow_graph"
      :style="{ '--ghost-commit-lane-x': `${FIRST_LANE_X}px` }"
    >
      <SkeletonBar
        :class="css.ghostCommitRow_lane"
        :width="1.5"
        :height="COMMIT_ROW_HEIGHT"
        :radius="0"
      />
      <SkeletonCircle
        :class="css.ghostCommitRow_dot"
        :size="9"
      />
    </span>
    <SkeletonBar
      :width="messageWidth"
      :height="9"
    />
    <span :class="css.ghostCommitRow_spacer" />
    <span :class="css.ghostCommitRow_author">
      <SkeletonCircle :size="16" />
      <SkeletonBar
        :class="css.ghostCommitRow_authorName"
        :width="authorWidth"
        :height="8"
        tone="weak"
      />
    </span>
    <span :class="css.ghostCommitRow_age">
      <SkeletonBar
        :width="18"
        :height="8"
        tone="weak"
      />
    </span>
  </Skeleton>
</template>

<style lang="scss" module="css">
// `CommitRow`'s box: its gap, the room at its right, the author 110px wide and the age 30px, right-aligned.
.ghostCommitRow {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding-right: $spacing-20;
  container-type: inline-size;
}

// `CommitGraphCell`'s width; the lane and the dot in the lines' tone, a step above the bars'.
.ghostCommitRow_graph {
  --skeleton-strong: #{$color-skeleton-card-strong};
  --skeleton-strong-highlight: #{$color-skeleton-card-strong-highlight};

  position: relative;
  flex: none;
  align-self: stretch;
  width: var(--commit-graph-width);
}

.ghostCommitRow_lane,
.ghostCommitRow_dot {
  position: absolute;
  left: var(--ghost-commit-lane-x);
  translate: -50% 0;
}

.ghostCommitRow_lane {
  top: 0;
}

.ghostCommitRow_dot {
  top: 50%;
  translate: -50% -50%;
}

.ghostCommitRow_spacer {
  flex: 1 0 0;
}

.ghostCommitRow_author {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  width: 110px;
}

.ghostCommitRow_age {
  display: flex;
  flex: none;
  justify-content: flex-end;
  width: 30px;
}

// As `CommitRow`: the author's name gives way to the avatar.
@container (max-width: 640px) {
  .ghostCommitRow_author {
    width: auto;
  }

  .ghostCommitRow_authorName {
    display: none;
  }
}
</style>
