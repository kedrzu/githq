<!-- A line of a diff side by side: the older version on the left, the newer on the right, a side with nothing blank. Long lines wrap, so the row is as tall as its taller side. -->
<script lang="ts" setup>
import DiffCode from './DiffCode.vue';
import type { DiffCell, DiffSplitRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';

defineProps<{
  line: DiffSplitRow;
  diff: FileDiff;
  syntax: FileSyntax | null;
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
        <DiffCode
          :text="getText(diff.before, line.left)"
          :tokens="syntax?.before.value ?? null"
          :line="line.left.line - 1"
        />
      </template>
    </div>
    <div :class="[css.diffRowSplit_cell, line.right && css[`diffRowSplit_cell_${line.right.kind}`]]">
      <template v-if="line.right">
        <span :class="css.diffRowSplit_number">{{ line.right.line }}</span>
        <DiffCode
          :text="getText(diff.after, line.right)"
          :tokens="syntax?.after.value ?? null"
          :line="line.right.line - 1"
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
  background: $color-diff-bg-deleted;

  .diffRowSplit_number {
    color: $color-red;
  }
}

.diffRowSplit_cell_added {
  color: $color-fg;
  background: $color-diff-bg-added;

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
</style>
