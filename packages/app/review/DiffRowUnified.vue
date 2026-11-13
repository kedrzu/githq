<!-- A line of a diff in one column: its old and new numbers, a gutter, a sign, and the line, the whole row tinted when added or deleted. Long lines wrap. The gutter holds the comment button on the line cursor's row (D43), on the line C takes: the newer, or the older on a deleted line; it is there on every row, so the code never shifts. The cursor's row is tinted over its own colour. -->
<script lang="ts" setup>
import { computed } from 'vue';

import DiffCode from './DiffCode.vue';
import DiffCommentButton from './DiffCommentButton.vue';
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
  /** The row holds the line cursor (D44): tinted, with the comment button. */
  cursor?: boolean;
}>();

const emit = defineEmits<{
  /** Something happened to a line's number or the comment button: a comment starts there (D32). */
  gutter: [event: MouseEvent, side: DiffLineSide, line: number];
}>();

/** The line's 0-based place in the version it's drawn from, the older only for a deleted line. */
const lineIndex = computed(() => (props.line.newLine ?? props.line.oldLine ?? 1) - 1);
/** Every row of the file sizes its number columns by the same number, which keeps them aligned. */
const largest = computed(() => Math.max(props.diff.before.length, props.diff.after.length));
const onAfter = computed(() => props.line.newLine !== null);
const side = computed((): DiffLineSide => (onAfter.value ? 'after' : 'before'));
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
      cursor && css.diffRowUnified_cursor,
    ]"
  >
    <DiffLineNumber
      :class="css.diffRowUnified_number"
      :line="line.oldLine"
      :largest="largest"
      :commented="line.oldLine !== null && isLineCommented(commented, 'before', line.oldLine)"
      @gutter="emit('gutter', $event, 'before', line.oldLine ?? 0)"
    />
    <DiffLineNumber
      :class="css.diffRowUnified_number"
      :line="line.newLine"
      :largest="largest"
      :commented="line.newLine !== null && isLineCommented(commented, 'after', line.newLine)"
      @gutter="emit('gutter', $event, 'after', line.newLine ?? 0)"
    />
    <span :class="css.diffRowUnified_gutter">
      <DiffCommentButton
        v-if="cursor"
        :line="lineIndex + 1"
        @gutter="emit('gutter', $event, side, lineIndex + 1)"
      />
    </span>
    <span :class="css.diffRowUnified_sign">{{ line.sign }}</span>
    <DiffCode
      :text="diff[side][lineIndex] ?? ''"
      :tokens="syntax?.[side].value ?? null"
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

// The cursor's tint under the row's own fill: the accent at 10% over the window, as a selected row's, which keeps every
// text over an added or a deleted line's fill AA (D30); laid over the fill instead, a deleted line's red number would
// not be.
.diffRowUnified_cursor {
  background-color: $color-sel;
}

.diffRowUnified_added {
  background-image: linear-gradient($color-diff-bg-added, $color-diff-bg-added);

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-green;
  }
}

.diffRowUnified_deleted {
  background-image: linear-gradient($color-diff-bg-deleted, $color-diff-bg-deleted);

  .diffRowUnified_number,
  .diffRowUnified_sign {
    color: $color-red;
  }
}

// Over the window, with the cursor or without: the accent number on a tint over the tint wouldn't keep AA.
.diffRowUnified_commented {
  background: linear-gradient(rgba($color-accent, 0.18), rgba($color-accent, 0.18)), $color-bg;
}

.diffRowUnified_number {
  flex: none;
  margin-right: $spacing-4;
  color: $color-fg-dim;
}

// The room for the comment button, on every row (D43): the code starts where it does with the cursor or without.
.diffRowUnified_gutter {
  display: flex;
  flex: none;
  justify-content: center;
  width: $spacing-24;
  padding-top: 2px;
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
