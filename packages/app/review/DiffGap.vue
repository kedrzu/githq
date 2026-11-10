<!-- The lines a diff leaves out between hunks, at a file's top or at its end (D42): arrows in the number gutter, as on github.com — ↓ shows 20 lines below the hunk above, ↑ 20 above the hunk below, a file's top having only ↑ and its end only ↓, a gap of 20 or fewer one ↕ for all of it — then the declaration what follows sits in, when it is a real one, and how many lines are hidden. Hovering an arrow lights it and has the count say what it does; the rest of the row is a click showing 20 toward the hunk `toward` names, and hovering it lights that arrow. The first gap of a file a push reset says so (CR62). The edge under a file's last gap is the block's own. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';

import { GAP_STEP, getGapArrows, getGapStep, getGapWay } from './buildReviewRows.js';
import type { ReviewGapDirection, ReviewGapRow, ReviewGapStep } from './buildReviewRows.js';
import * as l from './DiffGap.loc.js';

type Arrow = ReviewGapDirection | 'all';

const ICONS = { down: ChevronDown, up: ChevronUp, all: ChevronsUpDown } as const;

const props = defineProps<{
  row: ReviewGapRow;
  /** The hunk a click on the row shows lines toward, the one on the reading line's side. */
  toward: (gap: ReviewGapRow) => ReviewGapDirection;
}>();

const emit = defineEmits<{
  /** Shows so many lines of the gap, the way they come. */
  expand: [gap: ReviewGapRow, step: ReviewGapStep];
}>();

const t = useTranslate();

/** The arrow under the pointer, or the one a click on the rest of the row takes. */
const lit = shallowRef<Arrow | null>(null);
const arrows = computed((): Arrow[] => {
  const kind = getGapArrows(props.row);
  return kind === 'both' ? ['down', 'up'] : [kind];
});
const count = computed(() => {
  const { row } = props;
  const params = { count: row.hidden, formatted: numbers.format(row.hidden) };
  const way = getGapWay(row);
  const lines = t(way === 'down' ? l.linesBelow : way === 'up' ? l.linesAbove : l.lines, params);

  return row.expansionReset ? t(l.expansionReset, { lines }) : lines;
});

function getStep(arrow: Arrow): ReviewGapStep {
  return arrow === 'all' ? getGapStep(props.row, props.toward(props.row)) : { direction: arrow, count: GAP_STEP };
}

function getActionText(arrow: Arrow) {
  const { range, hidden } = props.row;
  switch (arrow) {
    case 'down':
      return t(l.showBelow, { count: GAP_STEP, line: range.afterStart });
    case 'up':
      return t(l.showAbove, { count: GAP_STEP, line: range.afterEnd + 1 });
    default:
      return t(l.showAll, { count: hidden, formatted: numbers.format(hidden) });
  }
}

function getRowArrow(): Arrow {
  return arrows.value.length === 1
    ? (arrows.value[0] ?? 'all')
    : getGapStep(props.row, props.toward(props.row)).direction;
}

function lightRowArrow(event: MouseEvent) {
  // An arrow lights itself.
  if (!(event.target instanceof Element && event.target.closest('button'))) {
    lit.value = getRowArrow();
  }
}

function expandFromRow() {
  emit('expand', props.row, getStep(getRowArrow()));
}
</script>

<template>
  <!-- The row's click is the pointer's shortcut to an arrow; the keyboard has the arrows themselves, and E. -->
  <div
    :class="[css.diffGap, row.atFileEnd && css.diffGap_fileEnd]"
    tid="review-gap"
    @click="expandFromRow"
    @mousemove="lightRowArrow"
    @mouseleave="lit = null"
  >
    <div :class="css.diffGap_gutter">
      <button
        v-for="arrow in arrows"
        :key="arrow"
        type="button"
        :class="[
          css.diffGap_arrow,
          arrows.length > 1 && css.diffGap_arrow_paired,
          lit === arrow && css.diffGap_arrow_lit,
        ]"
        :aria-label="getActionText(arrow)"
        @mouseenter="lit = arrow"
        @mouseleave="lit = null"
        @click.stop="emit('expand', row, getStep(arrow))"
      >
        <component
          :is="ICONS[arrow]"
          :class="css.diffGap_icon"
          aria-hidden="true"
        />
      </button>
    </div>
    <span
      v-if="row.enclosing"
      :class="css.diffGap_enclosing"
      >{{ row.enclosing }}</span
    >
    <span :class="[css.diffGap_count, (lit !== null || row.expansionReset) && css.diffGap_count_strong]">{{
      lit === null ? count : getActionText(lit)
    }}</span>
  </div>
</template>

<style lang="scss" module="css">
.diffGap {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding-right: $spacing-12;
  cursor: pointer;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
  border-bottom: 1px solid $color-border;
}

// The block's own edge follows it.
.diffGap_fileEnd {
  border-bottom: 0;
}

.diffGap_gutter {
  display: flex;
  flex: none;
  flex-direction: column;
  align-self: stretch;
  width: 48px;
  border-right: 1px solid $color-border;
}

.diffGap_arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 18px;
  padding: 0;
  color: $color-fg-3;
  cursor: pointer;
  background: none;
  border: 0;

  &:focus-visible {
    outline: 1px solid $color-accent;
    outline-offset: -1px;
  }
}

// Two stacked are each WCAG's 24 px a target (2.5.8): 18 px ones would sit too close to each other.
.diffGap_arrow_paired {
  height: 24px;
}

.diffGap_arrow_lit,
.diffGap_arrow:focus-visible {
  color: $color-fg;
  background: rgba($color-accent, 0.2);
}

.diffGap_icon {
  width: 14px;
  height: 14px;
}

.diffGap_enclosing {
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diffGap_count {
  flex: none;
  margin-left: auto;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.diffGap_count_strong {
  color: $color-fg-2;
}
</style>
