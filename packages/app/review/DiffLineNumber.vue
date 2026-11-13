<!-- A line's number in a diff, which starts a comment there (D32, CR70): a click on one line, a press and a drag along the lines or ⇧click for a range (CR73), all told by the event to whoever decides. A line a comment is being written on has it in accent; the comment button after it is the row's (`DiffCommentButton`, D43). The column is as wide as the file's largest number needs. Out of the Tab order: a file would be hundreds of stops, and `C` does the same from the keyboard. A row with no line on this side has an empty cell. A still one, of a file on its way (D45), is the number alone, as wide. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './DiffLineNumber.loc.js';

defineProps<{
  line: number | null;
  /** The file's largest line number, which the column is as wide as (D43). */
  largest: number;
  /** A comment is being written on the line: in accent. */
  commented?: boolean;
  /** Only the number, which nothing can be done to: the file isn't here yet. */
  still?: boolean;
}>();

const emit = defineEmits<{
  gutter: [event: MouseEvent];
}>();

const t = useTranslate();
</script>

<template>
  <span
    :class="css.diffLineNumber"
    :style="{ '--diff-line-number-digits': String(largest).length }"
  >
    <template v-if="line !== null && still">{{ line }}</template>
    <button
      v-else-if="line !== null"
      type="button"
      :class="[css.diffLineNumber_button, commented && css.diffLineNumber_button_commented]"
      tabindex="-1"
      :aria-label="t(l.commentOn, { line })"
      @click="emit('gutter', $event)"
      @pointerdown="emit('gutter', $event)"
    >
      <!-- In an element of its own: no space beside the number, which the column fits alone. -->
      <span>{{ line }}</span>
    </button>
  </span>
</template>

<style lang="scss" module="css">
.diffLineNumber {
  // The digits with some room before them, and 1 px the text's subpixels can't overflow. No round(): the desktop app runs
  // in system WebViews, which may be old.
  width: max(36px, calc(var(--diff-line-number-digits) * 1ch + #{$spacing-8} + 1px));
  font-family: $font-family-mono;
  font-size: 11px;
  line-height: 20px;
  text-align: right;
  user-select: none;
}

.diffLineNumber_button {
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;
}

.diffLineNumber_button_commented {
  color: $color-accent;
}
</style>
