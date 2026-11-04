<!-- A small box of the code a thread was written on, from its comment's `diffHunk` (D29), under a label saying that it is not the file as it is now. The hunk's last few lines, ending on the commented one. -->
<script lang="ts" setup>
import { FileClock } from 'lucide-vue-next';
import { computed } from 'vue';

import DiffCode from '../DiffCode.vue';
import type { DiffHunkLine } from './parseDiffHunk.js';

const props = defineProps<{
  label: string;
  lines: readonly DiffHunkLine[];
}>();

/** A hunk can run from far above the comment. */
const MAX_LINES = 4;

const shown = computed(() => props.lines.slice(-MAX_LINES));
</script>

<template>
  <figure :class="css.reviewThreadCode">
    <figcaption :class="css.reviewThreadCode_label">
      <FileClock
        :class="css.reviewThreadCode_icon"
        aria-hidden="true"
      />
      {{ label }}
    </figcaption>
    <div
      v-for="(line, index) in shown"
      :key="index"
      :class="[
        css.reviewThreadCode_line,
        line.sign === '+' && css.reviewThreadCode_line_added,
        line.sign === '-' && css.reviewThreadCode_line_deleted,
      ]"
    >
      <span :class="css.reviewThreadCode_number">{{ line.oldLine }}</span>
      <span :class="css.reviewThreadCode_number">{{ line.newLine }}</span>
      <span :class="css.reviewThreadCode_sign">{{ line.sign }}</span>
      <DiffCode
        :text="line.text"
        :tokens="null"
        :line="index"
      />
    </div>
  </figure>
</template>

<style lang="scss" module="css">
.reviewThreadCode {
  margin: 0;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.reviewThreadCode_label {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 24px;
  padding: 0 $spacing-10;
  font-size: 11.5px;
  color: $color-fg-dim;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

.reviewThreadCode_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.reviewThreadCode_line {
  display: flex;
  min-height: 20px;
  padding-right: $spacing-10;
  color: $color-fg-2;
  background: $color-bg;
}

.reviewThreadCode_line_added {
  color: $color-fg;
  background: linear-gradient($color-diff-bg-added, $color-diff-bg-added), $color-bg;

  .reviewThreadCode_number,
  .reviewThreadCode_sign {
    color: $color-green;
  }
}

.reviewThreadCode_line_deleted {
  color: $color-fg;
  background: linear-gradient($color-diff-bg-deleted, $color-diff-bg-deleted), $color-bg;

  .reviewThreadCode_number,
  .reviewThreadCode_sign {
    color: $color-red;
  }
}

.reviewThreadCode_number {
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

.reviewThreadCode_sign {
  flex: none;
  width: 22px;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: center;
  white-space: pre;
  user-select: none;
}
</style>
