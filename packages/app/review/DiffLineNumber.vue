<!-- A line's number in a diff, which starts a comment there (D32, CR70): a click on one line, a press and a drag or ⇧click for a range (CR73), all told by the event to whoever decides. Out of the Tab order: a file would be hundreds of stops, and `C` does the same from the keyboard. A row with no line on this side has an empty cell. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './DiffLineNumber.loc.js';

defineProps<{
  line: number | null;
}>();

const emit = defineEmits<{
  gutter: [event: MouseEvent];
}>();

const t = useTranslate();
</script>

<template>
  <span :class="css.diffLineNumber">
    <button
      v-if="line !== null"
      type="button"
      :class="css.diffLineNumber_button"
      tabindex="-1"
      :aria-label="t(l.commentOn, { line })"
      @click="emit('gutter', $event)"
      @pointerdown="emit('gutter', $event)"
      @pointerenter="emit('gutter', $event)"
    >
      {{ line }}
    </button>
  </span>
</template>

<style lang="scss" module="css">
.diffLineNumber {
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
  }
}
</style>
