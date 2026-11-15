<!-- A commit's row still on its way (first run and loading D17, `Empty / Ghost commit row`): a lane with a commit's dot on the graph's first lane, then `CommitRow`'s two lines (CH64) — a message bar on the first, the author's avatar and name and the age on the second — laid out to its metrics, the dot on the first line, so the row that replaces it lands without a jump. The graph is as wide as four lanes, a guess at the graph to come, so its rows land close to where it was. -->
<script lang="ts" setup>
import Skeleton from '@/components/Skeleton.vue';
import SkeletonBar from '@/components/SkeletonBar.vue';
import SkeletonCircle from '@/components/SkeletonCircle.vue';

import { COMMIT_ROW_DOT_Y, COMMIT_ROW_HEIGHT } from './CommitRow.vue';
import { COMMIT_GRAPH_LANE_WIDTH, COMMIT_GRAPH_PADDING, getCommitGraphWidth } from './fitCommitGraph.js';

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
/** The graph's width: four lanes. */
const GRAPH_WIDTH = getCommitGraphWidth(4);
</script>

<template>
  <Skeleton
    :class="css.ghostCommitRow"
    :style="{ height: `${COMMIT_ROW_HEIGHT}px` }"
    :row="row"
  >
    <span
      :class="css.ghostCommitRow_graph"
      :style="{
        width: `${GRAPH_WIDTH}px`,
        '--ghost-commit-lane-x': `${FIRST_LANE_X}px`,
        '--ghost-commit-dot-y': `${COMMIT_ROW_DOT_Y}px`,
      }"
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
    <span :class="css.ghostCommitRow_lines">
      <span :class="css.ghostCommitRow_line">
        <SkeletonBar
          :width="messageWidth"
          :height="9"
        />
      </span>
      <span :class="css.ghostCommitRow_line">
        <SkeletonCircle :size="16" />
        <SkeletonBar
          :width="authorWidth"
          :height="8"
          tone="weak"
        />
        <SkeletonBar
          :width="18"
          :height="8"
          tone="weak"
        />
      </span>
    </span>
  </Skeleton>
</template>

<style lang="scss" module="css">
// `CommitRow`'s box and its two lines.
.ghostCommitRow {
  @include commit-row;

  flex: none;
}

// The lane and the dot in the lines' tone, a step above the bars'.
.ghostCommitRow_graph {
  --skeleton-strong: #{$color-skeleton-card-strong};
  --skeleton-strong-highlight: #{$color-skeleton-card-strong-highlight};

  position: relative;
  flex: none;
  align-self: stretch;
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
  top: var(--ghost-commit-dot-y);
  translate: -50% -50%;
}

.ghostCommitRow_lines {
  @include commit-row-lines;
}

.ghostCommitRow_line {
  @include commit-row-line;
}
</style>
