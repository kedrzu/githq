<!-- A commit row's slice of the graph (git-client D18): the lines of the branches passing through it, straight on their lane or curving into and out of its dot, and its dot — grey, red while its CI fails, amber while it runs, hollow for a merge. Lanes from `lanes - 1` on are drawn on the last one (D17's folding), so a curve between two of them becomes a straight line there. -->
<script lang="ts">
/** The width of one lane of the graph. */
export const COMMIT_GRAPH_LANE_WIDTH = 12;
/** The room left of the first lane and right of the last. */
export const COMMIT_GRAPH_PADDING = 8;
</script>

<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed } from 'vue';

import type { CommitGraphRow } from './layoutCommitGraph.js';

const props = defineProps<{
  row: CommitGraphRow;
  /** How many lanes the graph shows; the lanes past the last are folded onto it. */
  lanes: number;
  /** The row's height, which the lines span. */
  height: number;
  /** Its CI state as the dot shows it: failing red, running amber, else grey. */
  tone: 'failing' | 'plain' | 'running';
}>();

const DOT_RADIUS = 3.5;

const width = computed(() => props.lanes * COMMIT_GRAPH_LANE_WIDTH + COMMIT_GRAPH_PADDING * 2);
const middle = computed(() => props.height / 2);
const dotX = computed(() => getX(props.row.column));
const paths = computed(() =>
  props.row.lines.map(line => {
    const x = getX(line.lane);
    const h = props.height;
    const m = middle.value;
    const dot = dotX.value;
    switch (line.half) {
      case 'full':
        return `M${x} 0V${h}`;
      case 'top':
        return x === dot ? `M${x} 0V${m}` : `M${x} 0Q${x} ${m} ${dot} ${m}`;
      case 'bottom':
        return x === dot ? `M${x} ${m}V${h}` : `M${dot} ${m}Q${x} ${m} ${x} ${h}`;
      default:
        return assertNever(line.half);
    }
  }),
);

function getX(lane: number) {
  return COMMIT_GRAPH_PADDING + (Math.min(lane, props.lanes - 1) + 0.5) * COMMIT_GRAPH_LANE_WIDTH;
}
</script>

<template>
  <svg
    :class="css.commitGraphCell"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
  >
    <path
      v-for="(path, index) in paths"
      :key="index"
      :class="css.commitGraphCell_line"
      :d="path"
    />
    <circle
      :class="[
        css.commitGraphCell_dot,
        css[`commitGraphCell_dot_${tone}`],
        row.isMerge && css.commitGraphCell_dot_merge,
      ]"
      :cx="dotX"
      :cy="middle"
      :r="DOT_RADIUS"
    />
  </svg>
</template>

<style lang="scss" module="css">
.commitGraphCell {
  flex: none;
  overflow: visible;
}

.commitGraphCell_line {
  fill: none;
  stroke: $color-fg-3;
  stroke-width: 1.5;
}

.commitGraphCell_dot {
  stroke-width: 1.5;
}

.commitGraphCell_dot_plain {
  fill: $color-fg-2;
  stroke: $color-fg-2;
}

.commitGraphCell_dot_failing {
  fill: $color-red;
  stroke: $color-red;
}

.commitGraphCell_dot_running {
  fill: $color-amber;
  stroke: $color-amber;
}

// Hollow: the row's own background shows through.
.commitGraphCell_dot_merge {
  fill: $color-bg;
}
</style>
