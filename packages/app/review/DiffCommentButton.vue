<!-- The comment button on the line cursor's row, between a line's number and its code, as on github.com (D43): a small accent square with a `+`, which takes clicks across the whole gutter around it, and whose tooltip names the line and the key C. It tells what happens to it as the number does, a click starting a comment and a press and drag along the lines or ⇧click making a range (CR73), so whoever decides treats the two alike. Out of the Tab order, as the number: `C` does the same from the keyboard. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Plus } from 'lucide-vue-next';

import Tooltip from '@/components/Tooltip.vue';

import * as l from './DiffCommentButton.loc.js';
import { REVIEW_KEYS } from './useReviewKeySheet.js';

defineProps<{
  /** The line it comments on, which its name and tooltip say. */
  line: number;
}>();

const emit = defineEmits<{
  gutter: [event: MouseEvent];
}>();

const t = useTranslate();
</script>

<template>
  <Tooltip
    :text="t(l.commentOn, { line })"
    :kbd="REVIEW_KEYS.comment"
  >
    <button
      type="button"
      :class="css.diffCommentButton"
      tabindex="-1"
      :aria-label="t(l.commentOn, { line })"
      :aria-keyshortcuts="REVIEW_KEYS.comment"
      @click="emit('gutter', $event)"
      @pointerdown="emit('gutter', $event)"
    >
      <Plus
        :class="css.diffCommentButton_icon"
        :stroke-width="2.5"
        aria-hidden="true"
      />
    </button>
  </Tooltip>
</template>

<style lang="scss" module="css">
.diffCommentButton {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  color: $color-on-light;
  cursor: pointer;
  background: $color-accent;
  border: 0;
  border-radius: $radius-sm;

  // The square stays small, but it takes a click anywhere in the row's 24 × 20 px gutter around it: a 16 px target
  // between a line's number and its code is easy to miss. No further, as the number and the code have clicks of their own.
  &::before {
    position: absolute;
    inset: -$spacing-2 (-$spacing-4);
    content: '';
  }

  // As a primary button's hover.
  &:hover {
    background: color-mix(in srgb, #{$color-accent} 88%, white);
  }
}

.diffCommentButton_icon {
  width: 12px;
  height: 12px;
}
</style>
