<!-- A line of a diff in one column: its old and new numbers, a sign, and the line, the whole row tinted when added or deleted. Long lines wrap. -->
<script lang="ts" setup>
import { computed } from 'vue';

import DiffCode from './DiffCode.vue';
import DiffLineNumber from './DiffLineNumber.vue';
import type { DiffLineSide, DiffUnifiedRow } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { FileSyntax } from './syntax/createFileSyntax.js';
import { isLineCommented } from './utils/isLineCommented.js';
import type { CommentedLines } from './utils/isLineCommented.js';

const props = defineProps<{
  line: DiffUnifiedRow;
  diff: FileDiff;
  syntax: FileSyntax | null;
  /** The lines a comment is being written on: tinted, their numbers in accent. */
  commented: CommentedLines;
}>();

const emit = defineEmits<{
  /** Something happened to a line's number: a comment starts there (D32). */
  gutter: [event: MouseEvent, side: DiffLineSide, line: number];
}>();

/** The line's 0-based place in the version it's drawn from, the older only for a deleted line. */
const lineIndex = computed(() => (props.line.newLine ?? props.line.oldLine ?? 1) - 1);
const onAfter = computed(() => props.line.newLine !== null);
const isCommented = computed(() => {
  const { oldLine, newLine } = props.line;
  return (
    (oldLine !== null && isLineCommented(props.commented, 'before', oldLine)) ||
    (newLine !== null && isLineCommented(props.commented, 'after', newLine))
  );
});
</script>

<template>
  <div
    :class="[
      css.diffRowUnified,
      line.sign === '+' && css.diffRowUnified_added,
      line.sign === '-' && css.diffRowUnified_deleted,
      isCommented && css.diffRowUnified_commented,
    ]"
  >
    <DiffLineNumber
      :class="css.diffRowUnified_number"
      :line="line.oldLine"
      :commented="line.oldLine !== null && isLineCommented(commented, 'before', line.oldLine)"
      @gutter="emit('gutter', $event, 'before', line.oldLine ?? 0)"
    />
    <DiffLineNumber
      :class="css.diffRowUnified_number"
      :line="line.newLine"
      :commented="line.newLine !== null && isLineCommented(commented, 'after', line.newLine)"
      @gutter="emit('gutter', $event, 'after', line.newLine ?? 0)"
    />
    <span :class="css.diffRowUnified_sign">{{ line.sign }}</span>
    <DiffCode
      :text="(onAfter ? diff.after : diff.before)[lineIndex] ?? ''"
      :tokens="(onAfter ? syntax?.after : syntax?.before)?.value ?? null"
      :line="lineIndex"
    />
  </div>
</template>

<style lang="scss" module="css">
.diffRowUnified {
  display: flex;
  min-height: 20px;
  padding-right: $spacing-10;
  color: $color-fg;
  background: $color-bg;
}

.diffRowUnified_added {
  color: $color-fg;
  background: linear-gradient($color-diff-bg-added, $color-diff-bg-added), $color-bg;

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-green;
  }
}

.diffRowUnified_deleted {
  color: $color-fg;
  background: linear-gradient($color-diff-bg-deleted, $color-diff-bg-deleted), $color-bg;

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-red;
  }
}

.diffRowUnified_commented {
  background: linear-gradient(rgba($color-accent, 0.18), rgba($color-accent, 0.18)), $color-bg;
}

.diffRowUnified_number {
  flex: none;
  width: 36px;
  margin-right: $spacing-4;
  color: $color-fg-dim;
}

.diffRowUnified_sign {
  flex: none;
  width: 28px;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: center;
  white-space: pre;
  user-select: none;
}
</style>
