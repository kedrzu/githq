<!-- A commit row's slice of the graph (git-client D18, CH61): the lines of the branches passing through it, straight on their lane or curving into and out of its dot, and its dot. Each line takes its lane's colour — the default branch's lane its light grey, every other lane a colour of the palette by its index, cycling (`$graph-lanes`), the first lane past the default branch's taking the first colour, so without a default branch's lane the first lane does — and a curve is the line of the lane farther from the trunk, so it takes that lane's colour. The dot (r = 3) is filled in its lane's colour, a merge hollow in it; a commit whose CI fails keeps a ring of its lane's colour (r = 5) round a red disc, 1 px of the row's own surface between them, amber while it runs — a shape of its own, so it doesn't lean on red alone. Inside a hollow dot and the ring the lines are cut, so the surface — stripe, hover or selection — shows through. Lanes from `lanes - 1` on are drawn on the last one (D17's folding), so a curve between two of them becomes a straight line there; while lanes are folded that line is thicker and the darker graph grey, being many branches, its dots the light grey. Under the lines, a ring 16 px across round the dot, shown as the row asks through `--commit-graph-ring-color` and `--commit-graph-ring-opacity` (CH54): softly while hovered, in the accent on the cursor's row. Its width is `--commit-graph-width`, set once on the rows, so dragging the graph's divider draws no row again until a lane folds or unfolds. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { computed, useId } from 'vue';

import { COMMIT_GRAPH_LANE_WIDTH, COMMIT_GRAPH_PADDING } from './fitCommitGraph.js';
import type { CommitGraphLineHalf, CommitGraphRow } from './layoutCommitGraph.js';

const props = defineProps<{
  row: CommitGraphRow;
  /** How many lanes the graph shows; the lanes past the last are folded onto it. */
  lanes: number;
  /** Whether any lanes are folded onto the last one. */
  folded: boolean;
  /** The first lane is the default branch's, drawn in its own light grey. */
  mainLane: boolean;
  /** The row's height, which the lines span. */
  height: number;
  /** Its CI state as the dot shows it: a red centre while failing, an amber one while running. */
  tone: 'failing' | 'plain' | 'running';
}>();

/** How many colours the lanes cycle through: `$graph-lanes`. */
const PALETTE_SIZE = 8;
const STROKE = 1.5;
/** The dot's outer edge. */
const DOT_RADIUS = 3;
/** A failing or running dot: the ring's outer edge, and the disc inside it, 1 px of surface between them. */
const MARKER_RADIUS = 5;
const MARKER_DISC_RADIUS = 2.5;
/** The hover and cursor ring's outer edge: 16 px across (CH54, CH61), clear of the marker. */
const RING_RADIUS = 8;

const maskId = useId();

const middle = computed(() => props.height / 2);
const dotX = computed(() => getX(props.row.column));
/** Each line once, however many lanes fold onto it: its colour, and whether it runs along the fold. */
const lines = computed(() => {
  const byPath = new Map<string, { readonly thick: boolean; readonly color: string }>();
  for (const line of props.row.lines) {
    const x = getX(line.lane);
    const straight = line.half === 'full' || x === dotX.value;
    byPath.set(getPath(line.half, x), {
      thick: props.folded && straight && isFolded(line.lane),
      color: isFolded(line.lane) ? 'folded' : getColor(line.lane),
    });
  }

  return byPath;
});
/** A dot on the fold is many branches' too: the light grey. */
const dotColor = computed(() => (isFolded(props.row.column) ? 'main' : getColor(props.row.column)));
/** How far round the dot the lines are cut, so the surface shows inside it; none under a filled dot. */
const hole = computed(() => {
  if (props.tone !== 'plain') {
    return MARKER_RADIUS - STROKE;
  }

  return props.row.isMerge ? DOT_RADIUS - STROKE : 0;
});

function isFolded(lane: number) {
  return props.folded && lane >= props.lanes - 1;
}

/** The colour of a lane not on the fold: the default branch's grey, or the palette's, the next lane taking the first. */
function getColor(lane: number) {
  if (props.mainLane && lane === 0) {
    return 'main';
  }

  return String(((lane - (props.mainLane ? 1 : 0)) % PALETTE_SIZE) + 1);
}

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
    <!-- Under the lines, which stay on top of it (CH54). -->
    <circle
      :class="css.commitGraphCell_ring"
      :cx="dotX"
      :cy="middle"
      :r="RING_RADIUS - STROKE / 2"
    />
    <!-- Cuts the lines inside a hollow dot or the marker's ring. -->
    <mask
      v-if="hole > 0"
      :id="maskId"
      maskUnits="userSpaceOnUse"
    >
      <rect
        width="100%"
        height="100%"
        fill="white"
      />
      <circle
        :cx="dotX"
        :cy="middle"
        :r="hole"
        fill="black"
      />
    </mask>
    <g :mask="hole > 0 ? `url(#${maskId})` : undefined">
      <path
        v-for="[path, line] in lines"
        :key="path"
        :class="[
          css.commitGraphCell_line,
          css[`commitGraphCell_color_${line.color}`],
          line.thick && css.commitGraphCell_line_thick,
        ]"
        :d="path"
      />
    </g>
    <circle
      v-if="tone === 'plain'"
      :class="[
        css.commitGraphCell_dot,
        css[`commitGraphCell_color_${dotColor}`],
        row.isMerge && css.commitGraphCell_dot_hollow,
      ]"
      :cx="dotX"
      :cy="middle"
      :r="row.isMerge ? DOT_RADIUS - STROKE / 2 : DOT_RADIUS"
    />
    <template v-else>
      <circle
        :class="[css.commitGraphCell_dot, css.commitGraphCell_dot_hollow, css[`commitGraphCell_color_${dotColor}`]]"
        :cx="dotX"
        :cy="middle"
        :r="MARKER_RADIUS - STROKE / 2"
      />
      <circle
        :class="css[`commitGraphCell_disc_${tone}`]"
        :cx="dotX"
        :cy="middle"
        :r="MARKER_DISC_RADIUS"
      />
    </template>
  </svg>
</template>

<style lang="scss" module="css">
.commitGraphCell {
  flex: none;
  width: var(--commit-graph-width);
  overflow: visible;
}

// The dot's ring, drawn by the row through custom properties: soft while hovered, the accent on the cursor's row.
.commitGraphCell_ring {
  fill: none;
  stroke: var(--commit-graph-ring-color, transparent);
  stroke-width: 1.5;
  opacity: var(--commit-graph-ring-opacity, 0);
}

// A line or a dot takes its lane's colour as `currentColor`.
.commitGraphCell_color_main {
  color: $color-graph-line-main;
}

.commitGraphCell_color_folded {
  color: $color-graph-line;
}

@each $index, $color in $graph-lanes {
  .commitGraphCell_color_#{$index} {
    color: $color;
  }
}

.commitGraphCell_line {
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.5;
}

// Several lanes on one line (D17).
.commitGraphCell_line_thick {
  stroke-width: 3;
}

.commitGraphCell_dot {
  fill: currentcolor;
}

// A merge, and a failing or running dot's ring: the row's own surface shows through, the lines cut inside it.
.commitGraphCell_dot_hollow {
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.5;
}

.commitGraphCell_disc_failing {
  fill: $color-red;
}

.commitGraphCell_disc_running {
  fill: $color-amber;
}
</style>
