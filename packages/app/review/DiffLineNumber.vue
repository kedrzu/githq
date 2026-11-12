<!-- A line's number in a diff, which starts a comment there (D32, CR70): a click on one line, a press and a drag or ⇧click for a range (CR73), all told by the event to whoever decides. Under the pointer it turns accent and underlined, a comment icon in the margin before it (D43); a line a comment is being written on has it in accent. The column is as wide as the file's largest number needs with the icon before it, so the icon never sticks out of its cell. Out of the Tab order: a file would be hundreds of stops, and `C` does the same from the keyboard. A row with no line on this side has an empty cell. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { MessageSquarePlus } from 'lucide-vue-next';

import * as l from './DiffLineNumber.loc.js';

defineProps<{
  line: number | null;
  /** The file's largest line number, which the column is as wide as with the icon before it (D43). */
  largest: number;
  /** A comment is being written on the line: in accent. */
  commented?: boolean;
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
    <button
      v-if="line !== null"
      type="button"
      :class="[css.diffLineNumber_button, commented && css.diffLineNumber_button_commented]"
      tabindex="-1"
      :aria-label="t(l.commentOn, { line })"
      @click="emit('gutter', $event)"
      @pointerdown="emit('gutter', $event)"
      @pointerenter="emit('gutter', $event)"
    >
      <!-- No space beside the number: the column fits the digits alone. -->
      <span :class="css.diffLineNumber_text"
        ><MessageSquarePlus
          :class="css.diffLineNumber_marker"
          :size="12"
          aria-hidden="true"
        />{{ line }}</span
      >
    </button>
  </span>
</template>

<style lang="scss" module="css">
.diffLineNumber {
  // The digits, then the icon and its margin, and 1 px the text's subpixels can't overflow. No round(): the desktop app
  // runs in system WebViews, which may be old.
  width: max(36px, calc(var(--diff-line-number-digits) * 1ch + 17px));
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

  &:hover {
    color: $color-accent;
    text-decoration: underline;
  }
}

.diffLineNumber_button_commented {
  color: $color-accent;
}

.diffLineNumber_text {
  position: relative;
}

.diffLineNumber_marker {
  position: absolute;
  top: 50%;
  right: 100%;
  display: none;
  margin-right: $spacing-4;
  color: $color-accent;
  pointer-events: none;
  transform: translateY(-50%);

  .diffLineNumber_button:hover & {
    display: block;
  }
}
</style>
