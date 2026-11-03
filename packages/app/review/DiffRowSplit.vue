<!-- A line of a diff side by side: the older version on the left, the newer on the right, a side with nothing blank. Long lines wrap, so the row is as tall as its taller side. -->
<script lang="ts" setup>
import type { DiffCell, DiffSplitRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';

defineProps<{
  line: DiffSplitRow;
  diff: FileDiff;
}>();

function getText(lines: readonly string[], cell: DiffCell) {
  return lines[cell.line - 1] ?? '';
}
</script>

<template>
  <div :class="css.diffRowSplit">
    <div :class="[css.diffRowSplit_cell, line.left && css[`diffRowSplit_cell_${line.left.kind}`]]">
      <template v-if="line.left">
        <span :class="css.diffRowSplit_number">{{ line.left.line }}</span>
        <code :class="css.diffRowSplit_code">{{ getText(diff.before, line.left) }}</code>
      </template>
    </div>
    <div :class="[css.diffRowSplit_cell, line.right && css[`diffRowSplit_cell_${line.right.kind}`]]">
      <template v-if="line.right">
        <span :class="css.diffRowSplit_number">{{ line.right.line }}</span>
        <code :class="css.diffRowSplit_code">{{ getText(diff.after, line.right) }}</code>
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
  gap: $spacing-12;
  min-width: 0;
  padding-right: $spacing-10;
  color: $color-fg-2;

  & + & {
    border-left: 1px solid $color-border;
  }
}

.diffRowSplit_cell_deleted {
  color: $color-fg;
  background: $color-diff-deleted;

  .diffRowSplit_number {
    color: $color-red;
  }
}

.diffRowSplit_cell_added {
  color: $color-fg;
  background: $color-diff-added;

  .diffRowSplit_number {
    color: $color-green;
  }
}

.diffRowSplit_number {
  flex: none;
  width: 36px;
  font-family: $font-family-mono;
  font-size: 11px;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: right;
  user-select: none;
}

.diffRowSplit_code {
  min-width: 0;
  font-family: $font-family-mono;
  font-size: 12px;
  line-height: 20px;
  tab-size: 4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
