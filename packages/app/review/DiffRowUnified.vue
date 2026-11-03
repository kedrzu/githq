<!-- A line of a diff in one column: its old and new numbers, a sign, and the line, the whole row tinted when added or deleted. Long lines wrap. -->
<script lang="ts" setup>
import { computed } from 'vue';

import type { DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';

const props = defineProps<{
  line: DiffUnifiedRow;
  diff: FileDiff;
}>();

const text = computed(() => {
  const { oldLine, newLine } = props.line;
  return (newLine === null ? props.diff.before[(oldLine ?? 1) - 1] : props.diff.after[newLine - 1]) ?? '';
});
</script>

<template>
  <div
    :class="[
      css.diffRowUnified,
      line.sign === '+' && css.diffRowUnified_added,
      line.sign === '-' && css.diffRowUnified_deleted,
    ]"
  >
    <span :class="css.diffRowUnified_number">{{ line.oldLine }}</span>
    <span :class="css.diffRowUnified_number">{{ line.newLine }}</span>
    <span :class="css.diffRowUnified_sign">{{ line.sign }}</span>
    <code :class="css.diffRowUnified_code">{{ text }}</code>
  </div>
</template>

<style lang="scss" module="css">
.diffRowUnified {
  display: flex;
  min-height: 20px;
  padding-right: $spacing-10;
  color: $color-fg-2;
  background: $color-bg;
}

.diffRowUnified_added {
  color: $color-fg;
  background: linear-gradient($color-diff-added, $color-diff-added), $color-bg;

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-green;
  }
}

.diffRowUnified_deleted {
  color: $color-fg;
  background: linear-gradient($color-diff-deleted, $color-diff-deleted), $color-bg;

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-red;
  }
}

.diffRowUnified_number {
  flex: none;
  width: 36px;
  margin-right: $spacing-4;
  font-family: $font-family-mono;
  font-size: 11px;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: right;
  user-select: none;
}

.diffRowUnified_sign {
  flex: none;
  width: 28px;
  font-family: $font-family-mono;
  font-size: 12px;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: center;
  white-space: pre;
  user-select: none;
}

.diffRowUnified_code {
  min-width: 0;
  font-family: $font-family-mono;
  font-size: 12px;
  line-height: 20px;
  tab-size: 4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
