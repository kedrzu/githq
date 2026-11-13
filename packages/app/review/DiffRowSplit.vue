<!-- A line of a diff side by side: the older version on the left, the newer on the right, a side with nothing blank. Long lines wrap, so the row is as tall as its taller side. Between each half's number and its code a gutter holds the comment button on the line cursor's row (D43), there on every row so the code never shifts; the cursor's row is tinted, both halves, over their own colours, unless the keys are in a text field, and each half's button comments on its own line, or an empty half's on the row's line, the one C takes. -->
<script lang="ts" setup>
import { computed } from 'vue';

import DiffCode from './DiffCode.vue';
import DiffCommentButton from './DiffCommentButton.vue';
import DiffLineNumber from './DiffLineNumber.vue';
import type { DiffCell, DiffLineSide, DiffSplitRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { isLineCommented } from './utils/isLineCommented.js';
import type { CommentedLines } from './utils/isLineCommented.js';

interface Half {
  readonly side: DiffLineSide;
  readonly cell: DiffCell | null;
  /** The line its comment button comments on: its own, or on an empty half the row's. */
  readonly target: { readonly side: DiffLineSide; readonly line: number } | null;
}

const props = defineProps<{
  line: DiffSplitRow;
  diff: FileDiff;
  syntax: FileSyntax | null;
  /** The lines a comment is being written on: tinted, their numbers in accent. */
  commented: CommentedLines;
  /** The row holds the line cursor (D44): tinted, a comment button in each half. */
  cursor?: boolean;
  /** The keys are in a text field, which C or V would type into: the cursor's row keeps its buttons, not its tint. */
  quiet?: boolean;
}>();

const emit = defineEmits<{
  /** Something happened to a line's number or a comment button: a comment starts there (D32). */
  gutter: [event: MouseEvent, side: DiffLineSide, line: number];
}>();

/** Every row of the file sizes its number columns by the same number, which keeps them aligned. */
const largest = computed(() => Math.max(props.diff.before.length, props.diff.after.length));
const halves = computed((): Half[] => {
  const { left, right } = props.line;
  const older = left && { side: 'before' as const, line: left.line };
  const newer = right && { side: 'after' as const, line: right.line };
  const row = newer ?? older;
  return [
    { side: 'before', cell: left, target: older ?? row },
    { side: 'after', cell: right, target: newer ?? row },
  ];
});

function getText(side: DiffLineSide, cell: DiffCell) {
  return props.diff[side][cell.line - 1] ?? '';
}

function isCommented(side: DiffLineSide, cell: DiffCell | null) {
  return cell !== null && isLineCommented(props.commented, side, cell.line);
}
</script>

<template>
  <div :class="[css.diffRowSplit, cursor && !quiet && css.diffRowSplit_cursor]">
    <div
      v-for="half in halves"
      :key="half.side"
      :class="[
        css.diffRowSplit_cell,
        half.cell && css[`diffRowSplit_cell_${half.cell.kind}`],
        isCommented(half.side, half.cell) && css.diffRowSplit_cell_commented,
      ]"
    >
      <template v-if="half.cell || cursor">
        <DiffLineNumber
          :class="css.diffRowSplit_number"
          :line="half.cell?.line ?? null"
          :largest="largest"
          :commented="isCommented(half.side, half.cell)"
          @gutter="emit('gutter', $event, half.side, half.cell?.line ?? 0)"
        />
        <span :class="css.diffRowSplit_gutter">
          <DiffCommentButton
            v-if="cursor && half.target"
            :line="half.target.line"
            @gutter="half.target && emit('gutter', $event, half.target.side, half.target.line)"
          />
        </span>
        <DiffCode
          v-if="half.cell"
          :text="getText(half.side, half.cell)"
          :tokens="syntax?.[half.side].value ?? null"
          :line="half.cell.line - 1"
        />
      </template>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.diffRowSplit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 20px;
  background: $color-bg;
}

.diffRowSplit_cell {
  display: flex;
  min-width: 0;
  padding-right: $spacing-10;
  color: $color-fg;

  & + & {
    border-left: 1px solid $color-border;
  }
}

// The cursor's tint under the halves' own fills: the accent at 10% over the window, as a selected row's, which keeps
// every text over an added or a deleted line's fill AA (D30); laid over the fill instead, a deleted line's red number
// would not be.
.diffRowSplit_cursor {
  background: $color-sel;
}

.diffRowSplit_cell_deleted {
  background: $color-diff-bg-deleted;

  .diffRowSplit_number {
    color: $color-red;
  }
}

.diffRowSplit_cell_added {
  background: $color-diff-bg-added;

  .diffRowSplit_number {
    color: $color-green;
  }
}

.diffRowSplit_cell_commented {
  background: rgba($color-accent, 0.18);

  // Over the window, with the cursor too: the accent number on a tint over the tint wouldn't keep AA.
  .diffRowSplit_cursor & {
    background: linear-gradient(rgba($color-accent, 0.18), rgba($color-accent, 0.18)), $color-bg;
  }
}

.diffRowSplit_number {
  flex: none;
  color: $color-fg-dim;
}

// The room for the comment button, on every row (D43): the code starts where it does with the cursor or without.
.diffRowSplit_gutter {
  display: flex;
  flex: none;
  justify-content: center;
  width: $spacing-24;
  padding-top: 2px;
}
</style>
