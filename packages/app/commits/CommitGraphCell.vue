<!-- A commit row's slice of the graph (git-client D18): the lines of the branches passing through it, straight on their lane or curving into and out of its dot, and its dot — grey, red while its CI fails, amber while it runs, hollow for a merge. Lanes from `lanes - 1` on are drawn on the last one (D17's folding), so a curve between two of them becomes a straight line there, and that line is drawn thicker while lanes are folded. The default branch's lane is lighter than the rest. Its width is `--commit-graph-width`, set once on the rows, so dragging the graph's divider draws no row again until a lane folds or unfolds. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed } from 'vue';

import { COMMIT_GRAPH_LANE_WIDTH, COMMIT_GRAPH_PADDING } from './fitCommitGraph.js';
import type { CommitGraphLineHalf, CommitGraphRow } from './layoutCommitGraph.js';

const props = defineProps<{
  row: CommitGraphRow;
  /** How many lanes the graph shows; the lanes past the last are folded onto it. */
  lanes: number;
  /** Whether any lanes are folded onto the last one. */
  folded: boolean;
  /** The first lane is the default branch's, drawn lighter than the rest. */
  mainLane: boolean;
  /** The row's height, which the lines span. */
  height: number;
  /** Its CI state as the dot shows it: failing red, running amber, else grey. */
  tone: 'failing' | 'plain' | 'running';
}>();

const DOT_RADIUS = 3.5;

const middle = computed(() => props.height / 2);
const dotX = computed(() => getX(props.row.column));
/** Each line once, however many lanes fold onto it: whether it runs along the fold, and on the default branch. */
const lines = computed(() => {
  const byPath = new Map<string, { readonly thick: boolean; readonly main: boolean }>();
  for (const line of props.row.lines) {
    const x = getX(line.lane);
    const straight = line.half === 'full' || x === dotX.value;
    byPath.set(getPath(line.half, x), {
      thick: props.folded && straight && line.lane >= props.lanes - 1,
      main: props.mainLane && line.lane === 0,
    });
  }

  return byPath;
});

function getPath(half: CommitGraphLineHalf, x: number) {
  const h = props.height;
  const m = middle.value;
  const dot = dotX.value;
  switch (half) {
    case 'full':
      return `M${x} 0V${h}`;
    case 'top':
      return x === dot ? `M${x} 0V${m}` : `M${x} 0Q${x} ${m} ${dot} ${m}`;
    case 'bottom':
      return x === dot ? `M${x} ${m}V${h}` : `M${dot} ${m}Q${x} ${m} ${x} ${h}`;
    default:
      return assertNever(half);
  }
}

function getX(lane: number) {
  return COMMIT_GRAPH_PADDING + (Math.min(lane, props.lanes - 1) + 0.5) * COMMIT_GRAPH_LANE_WIDTH;
}
</script>

<template>
  <svg
    :class="css.commitGraphCell"
    :height="height"
    aria-hidden="true"
  >
    <path
      v-for="[path, line] in lines"
      :key="path"
      :class="[
        css.commitGraphCell_line,
        line.thick && css.commitGraphCell_line_folded,
        line.main && css.commitGraphCell_line_main,
      ]"
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
  width: var(--commit-graph-width);
  overflow: visible;
}

.commitGraphCell_line {
  fill: none;
  stroke: $color-graph-line;
  stroke-width: 1.5;
}

.commitGraphCell_line_main {
  stroke: $color-graph-line-main;
}

// Several lanes on one line (D17).
.commitGraphCell_line_folded {
  stroke-width: 3;
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
