<!-- The mark above code shown out of place for its thread (D29): a vertical arrow, how far it is from the nearest change, or that the line is a hidden whitespace change (CR11), why it shows, a rule, and "Expand to here", which brings out the context up to it. Under the last such code of a file's last gap it says what is left to the file's end (CR11). Not the filled gap between hunks. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { MoveVertical } from 'lucide-vue-next';
import { computed } from 'vue';

import type { ReviewDistanceRow, ReviewFileEndRow } from '../buildReviewRows.js';

import * as l from './ReviewDistanceRow.loc.js';

const props = defineProps<{
  row: ReviewDistanceRow | ReviewFileEndRow;
}>();

const emit = defineEmits<{
  expand: [];
}>();

const t = useTranslate();

const distance = computed(() => {
  const { row } = props;
  if (row.kind === 'fileEnd') {
    return t(l.toFileEnd, { count: row.hidden, formatted: numbers.format(row.hidden) });
  }

  const { whitespaceChange, line, distance: lines, direction } = row.placement;
  return whitespaceChange
    ? t(l.whitespaceLine, { line })
    : t(l.further, { count: lines, formatted: numbers.format(lines), way: t(l[direction]) });
});
const why = computed(() => {
  const { row } = props;
  if (row.kind === 'fileEnd') {
    return t(l.noChangesThere);
  }

  return row.placement.whitespaceChange ? t(l.whitespaceWhy) : t(l.why);
});
</script>

<template>
  <div :class="css.reviewDistanceRow">
    <MoveVertical
      :class="css.reviewDistanceRow_icon"
      aria-hidden="true"
    />
    <span :class="css.reviewDistanceRow_distance">{{ distance }}</span>
    <span :class="css.reviewDistanceRow_why">{{ why }}</span>
    <span :class="css.reviewDistanceRow_rule" />
    <button
      type="button"
      :class="css.reviewDistanceRow_expand"
      @click="emit('expand')"
    >
      {{ t(l.expandToHere) }}
    </button>
  </div>
</template>

<style lang="scss" module="css">
.reviewDistanceRow {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-12;
  font-size: 11.5px;
  background: $color-bg;
}

.reviewDistanceRow_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-2;
}

.reviewDistanceRow_distance {
  flex: none;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.reviewDistanceRow_why {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewDistanceRow_rule {
  flex: 1;
  min-width: $spacing-8;
  height: 1px;
  background: $color-border-2;
}

.reviewDistanceRow_expand {
  @include focus-ring;

  flex: none;
  padding: 0;
  font: inherit;
  color: $color-fg-dim;
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;

  &:hover {
    color: $color-fg;
  }
}
</style>
