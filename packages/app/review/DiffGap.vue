<!-- The lines a diff leaves out between hunks, at a file's top or at its end (D42): arrows side by side in the number gutter, as on github.com — ↓ shows 20 lines below the hunk above, ↑ 20 above the hunk below, a file's top having only ↑ and its end only ↓, a gap of 20 or fewer one ↕ for all of it — then the declaration what follows sits in, when it is a real one, and how many lines are hidden. Hovering an arrow lights it and has the count say what it does, and with the keyboard's focus on it the count says what ↵ does; the rest of the row is a click showing 20 toward the hunk `toward` names, and hovering it lights that arrow. The first gap of a file a push reset says so (CR62); one with nothing hidden, its lines all shown for threads, says only that, with no arrow and no click. The edge under a file's last gap is the block's own. A file still on its way draws its patch's gaps the same, as tall, and still: its arrows do nothing and take no focus, and the one after its last hunk says no count, which the patch doesn't know (D45). -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';

import { GAP_STEP, getGapArrows, getGapStep, getGapWay } from './buildReviewRows.js';
import type { ReviewGapArrows, ReviewGapDirection, ReviewGapRow, ReviewGapStep } from './buildReviewRows.js';
import * as l from './DiffGap.loc.js';
import type { PlaceholderGap } from './utils/getPlaceholderMask.js';

type Arrow = ReviewGapDirection | 'all';

const ICONS = { down: ChevronDown, up: ChevronUp, all: ChevronsUpDown } as const;

const props = defineProps<{
  /** A file's gap, or one of a file still on its way, which nothing can be done to. */
  row: ReviewGapRow | PlaceholderGap;
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
/** The arrow with the keyboard's focus, not a click's. */
const focused = shallowRef<Arrow | null>(null);
/** A file's own gap, which its arrows and a click show lines of; `null` for one of a file on its way. */
const real = computed(() => (props.row.kind === 'gap' ? props.row : null));
/** Its lines are all shown for threads: the row is there only to say a push reset it. */
const nothingHidden = computed(() => props.row.hidden === 0);
const atFileEnd = computed(() => (props.row.kind === 'gap' ? props.row.atFileEnd : props.row.way === 'down'));
const arrows = computed((): Arrow[] => {
  if (nothingHidden.value) {
    return [];
  }

  const kind = props.row.kind === 'gap' ? getGapArrows(props.row) : getStillArrows(props.row);
  return kind === 'both' ? ['down', 'up'] : [kind];
});
const count = computed(() => {
  const { row } = props;
  if (nothingHidden.value) {
    return t(l.expansionResetOnly);
  }

  if (row.hidden === null) {
    return '';
  }

  const params = { count: row.hidden, formatted: numbers.format(row.hidden) };
  const way = row.kind === 'gap' ? getGapWay(row) : row.way;
  const lines = t(way === 'down' ? l.linesBelow : way === 'up' ? l.linesAbove : l.lines, params);

  return row.kind === 'gap' && row.expansionReset ? t(l.expansionReset, { lines }) : lines;
});
const text = computed(() => {
  if (lit.value !== null) {
    return getActionText(lit.value, false);
  }

  return focused.value === null ? count.value : getActionText(focused.value, true);
});

/** The arrows a file's gap will have where the patch has one, as {@link getGapArrows} gives them. */
function getStillArrows({ hidden, way }: PlaceholderGap): ReviewGapArrows {
  if (hidden !== null && hidden <= GAP_STEP) {
    return 'all';
  }

  return way ?? 'both';
}

function getStep(gap: ReviewGapRow, arrow: Arrow): ReviewGapStep {
  return arrow === 'all' ? getGapStep(gap, props.toward(gap)) : { direction: arrow, count: GAP_STEP };
}

/** What an arrow does, as hovering says it, or as its keyboard focus says ↵ does it; nothing on a still gap. */
function getActionText(arrow: Arrow, byEnter: boolean) {
  if (!real.value) {
    return '';
  }

  const { range, hidden } = real.value;
  switch (arrow) {
    case 'down':
      return t(byEnter ? l.enterShowsBelow : l.showBelow, { count: GAP_STEP, line: range.afterStart });
    case 'up':
      return t(byEnter ? l.enterShowsAbove : l.showAbove, { count: GAP_STEP, line: range.afterEnd + 1 });
    default:
      return t(byEnter ? l.enterShowsAll : l.showAll, { count: hidden, formatted: numbers.format(hidden) });
  }
}

function focusArrow(arrow: Arrow, event: FocusEvent) {
  focused.value = event.target instanceof Element && event.target.matches(':focus-visible') ? arrow : null;
}

function getRowArrow(gap: ReviewGapRow): Arrow {
  return arrows.value.length === 1 ? (arrows.value[0] ?? 'all') : getGapStep(gap, props.toward(gap)).direction;
}

function lightRowArrow(event: MouseEvent) {
  // An arrow lights itself.
  if (real.value && !nothingHidden.value && !(event.target instanceof Element && event.target.closest('button'))) {
    lit.value = getRowArrow(real.value);
  }
}

function expandFromRow() {
  if (real.value && !nothingHidden.value) {
    emit('expand', real.value, getStep(real.value, getRowArrow(real.value)));
  }
}
</script>

<template>
  <!-- The row's click is the pointer's shortcut to an arrow; the keyboard has the arrows themselves, and E. -->
  <div
    :class="[css.diffGap, atFileEnd && css.diffGap_fileEnd, (nothingHidden || !real) && css.diffGap_still]"
    :tid="real ? 'review-gap' : 'review-placeholder-gap'"
    @click="expandFromRow"
    @mousemove="lightRowArrow"
    @mouseleave="lit = null"
  >
    <div :class="css.diffGap_gutter">
      <template v-if="!real">
        <span
          v-for="arrow in arrows"
          :key="arrow"
          :class="[css.diffGap_arrow, css.diffGap_arrow_still]"
        >
          <component
            :is="ICONS[arrow]"
            :class="css.diffGap_icon"
            aria-hidden="true"
          />
        </span>
      </template>
      <template v-else>
        <button
          v-for="arrow in arrows"
          :key="arrow"
          type="button"
          :class="[css.diffGap_arrow, lit === arrow && css.diffGap_arrow_lit]"
          :aria-label="getActionText(arrow, false)"
          @mouseenter="lit = arrow"
          @mouseleave="lit = null"
          @focus="focusArrow(arrow, $event)"
          @blur="focused = null"
          @click.stop="real && emit('expand', real, getStep(real, arrow))"
        >
          <component
            :is="ICONS[arrow]"
            :class="css.diffGap_icon"
            aria-hidden="true"
          />
        </button>
      </template>
    </div>
    <span
      v-if="real?.enclosing && !nothingHidden"
      :class="css.diffGap_enclosing"
      >{{ real.enclosing }}</span
    >
    <span
      :class="[
        css.diffGap_count,
        (lit !== null || focused !== null || real?.expansionReset) && css.diffGap_count_strong,
      ]"
      >{{ text }}</span
    >
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

// Nothing to show: no click.
.diffGap_still {
  cursor: default;
}

// A still gap's arrows do nothing.
.diffGap_arrow_still {
  cursor: default;
}

// Two arrows side by side fill it, its edge outside them; one sits in its middle; with none it keeps the row as tall.
.diffGap_gutter {
  box-sizing: content-box;
  display: flex;
  flex: none;
  justify-content: center;
  width: 48px;
  min-height: 24px;
  border-right: 1px solid $color-border;
}

// WCAG's 24 px a target (2.5.8).
.diffGap_arrow {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
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
