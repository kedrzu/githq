<!-- A virtual list that holds what you look at in place (code review's D7): only rows near the screen exist, heights nobody knows until they are drawn are absorbed into the scroll position, and `jumpTo` lands on a row by drawing it first, so the estimates only steer the native scrollbar. `anchor` says where you are, as a row and its distance from the top, for `jumpTo` to come back to; `getShownRows` and `getViewport` what is on screen. Rows that are `isPinned` head what follows them, in an overlay at the top that the next one pushes away, staying its `pushRoom` below it, and `topRoom` over the rows that they scroll through and that the overlay's own background covers once one is pinned; the slot says which copy is the overlay's and when it is being pushed. Pass `rows` as a new plain array (a `shallowRef`) when they change: rebuilding costs O(n), and the props `estimateHeight` and `isPinned` are read only then. A row keeps its own background under the overlay, and a jump meant to clear a pinned row asks for an offset below it. `inset` draws the rows and the overlay that far in from both sides, in a box narrower than the scroller, whose gaps still scroll the list and whose scrollbar stays at the edge; a change of it re-measures the rows as a change of width does, holding what you look at. -->
<script lang="ts">
import type { VNodeChild } from 'vue';

import type { AnchoredListRow } from './anchoredList/createAnchoredListModel.js';

/** The slot's props. */
export interface AnchoredListSlotProps<T> {
  row: T;
  /** The row is the pinned one, and the next pinned row is pushing it up. */
  pushed: boolean;
  /** The row is the pinned one's copy in the overlay, the row in its place being drawn too. */
  pinned: boolean;
}

/** What the viewport shows: for the line cursor's scrolling and the reading line (`getReadingLine`). */
export interface AnchoredListViewport {
  readonly height: number;
  /** How far down from its top the pinned row's overlay reaches. */
  readonly covered: number;
  /** How far the list is scrolled from its top. */
  readonly scrolled: number;
  /** How much further down the list can scroll. */
  readonly remaining: number;
}

/** A row on screen, its edges measured from the viewport's top. */
export interface AnchoredListShownRow<T> {
  readonly row: T;
  readonly top: number;
  readonly bottom: number;
}

/** What a template ref to the list gives. */
export interface AnchoredListExposed<T = AnchoredListRow> {
  /** Lands the row at `offset` from the viewport's top and holds it there; an unknown key leaves the list as it is. */
  jumpTo(key: string, offset?: number): void;
  /**
   * Gives the list the focus, for the keys to scroll it, moving nothing and without a focus ring: nobody got there by
   * keyboard, whatever the browser concludes from the last key pressed. Tabbing back to it shows the ring as usual.
   */
  focus(): void;
  /** Scrolls by so many pixels, down if positive, as the user's own scroll would. */
  scrollBy(distance: number): void;
  /** The distance of a drawn row's top from the viewport's top, for `jumpTo` to hold it there; `null` for one not drawn. */
  getRowOffset(key: string): number | null;
  /** A drawn row's edges from the viewport's top, on screen or not; `null` for one not drawn. */
  getRowBox(key: string): AnchoredListShownRow<T> | null;
  /** Reactive: it changes with the scroll and the layout, at most once a frame. */
  getViewport(): AnchoredListViewport;
  /**
   * The rows touching the viewport, those under the pinned row's overlay included, top to bottom. Reactive as
   * `getViewport` is.
   */
  getShownRows(): AnchoredListShownRow<T>[];
  /** Where you are, reactive: it changes at most once a frame, with the scroll event. */
  readonly anchor: AnchoredListAnchor | null;
  /** The key of the first row showing under the pinned one, reactive: `anchor` is usually hidden behind that. */
  readonly firstVisibleKey: string | null;
  /** The scroller's width inside its scrollbar, reactive: the room for the rows' box, 0 while it is not displayed. */
  readonly width: number;
}

/** How far the rendered rows reach beyond the viewport, each way: about a screen. */
const OVERSCAN = 600;
/** A difference in scroll position only float arithmetic can make: writing it would disturb a scroll in progress. */
const SCROLL_EPSILON = 0.01;

/**
 * Draws one row. It is a component so that the list re-rendering, which it does whenever rows move, runs a row's slot
 * only if the row itself changed: a position is the wrapper's in the list's own render. The slot is a plain prop because
 * a `<slot>` inside `v-for` compiles to dynamic slots, which update the child every time.
 */
function AnchoredListCell<T>(props: AnchoredListCellProps<T>) {
  return props.render({ row: props.row, pushed: props.pushed, pinned: props.pinned });
}

interface AnchoredListCellProps<T> extends AnchoredListSlotProps<T> {
  render: (slotProps: AnchoredListSlotProps<T>) => VNodeChild;
}
</script>

<script lang="ts" setup generic="T extends AnchoredListRow">
import { assertValue } from '@nzyme/utils/assert.js';
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import type { ObjectDirective } from 'vue';

import { createAnchoredListModel } from './anchoredList/createAnchoredListModel.js';
import type {
  AnchoredListAnchor,
  AnchoredListPinnedRow,
  AnchoredListPlacedRow,
  AnchoredListRange,
} from './anchoredList/createAnchoredListModel.js';

const props = withDefaults(
  defineProps<{
    rows: readonly T[];
    /** A row's height until it has been drawn. */
    estimateHeight: (row: T) => number;
    isPinned?: (row: T) => boolean;
    /** How far below the one it pushes up a pinned row stays, the background showing between them. */
    pushRoom?: number;
    /**
     * Room at the top, inside the scroller: the rows start below it and scroll through it up to the edge, and the pinned
     * row's overlay stands below it with the background over it, so nothing scrolling shows above the overlay and nothing
     * is cut short of the edge. The offsets the list takes and gives are measured from under it. No wider than
     * `pushRoom`: a pushed row leaves at the edge only when the next one pins, its last strip vanishing at once otherwise.
     */
    topRoom?: number;
    /** How far in from each side of the scroller the rows and the overlay are drawn, the gaps empty. */
    inset?: number;
    /** What the list is, for screen readers. */
    label: string;
  }>(),
  { isPinned: () => false, topRoom: 0, inset: 0 },
);

const emit = defineEmits<{
  /**
   * The scroll position moved, and not by anything the list did: it's the user's, by wheel, key or scrollbar. The
   * distance is how far, down if positive.
   */
  userScroll: [distance: number];
  /** A row with the focus inside it left the window, or the list: the list took the focus, for whoever wants it back. */
  rowFocusLost: [key: string];
}>();

const slots = defineSlots<{
  default(slotProps: AnchoredListSlotProps<T>): VNodeChild;
}>();

const scroller = useTemplateRef<HTMLElement>('scroller');
const spacer = useTemplateRef<HTMLElement>('spacer');
const model = createAnchoredListModel<T>({
  estimateHeight: row => props.estimateHeight(row),
  isPinned: row => props.isPinned(row),
  get pushRoom() {
    return props.pushRoom;
  },
});
model.setRows(props.rows);

const anchor = shallowRef(model.anchor);
const firstVisibleKey = shallowRef<string | null>(null);
const width = shallowRef(0);
const focusedQuietly = shallowRef(false);
const placedRows = shallowRef<AnchoredListPlacedRow<T>[]>([]);
const pinnedRow = shallowRef<AnchoredListPinnedRow<T> | null>(null);
/** What the viewport showed when the window was last placed: what makes `getViewport` and `getShownRows` reactive. */
const viewport = shallowRef<AnchoredListViewport>({ height: 0, covered: 0, scrolled: 0, remaining: 0 });

const observer = new ResizeObserver(onResize);
const measuredKeys = new WeakMap<Element, string>();
const rowsToObserve = new Set<Element>();
const vMeasured: ObjectDirective<HTMLElement, string> = {
  mounted(element, { value }) {
    measuredKeys.set(element, value);
    if (observationHeldBack === 0) {
      observer.observe(element, { box: 'border-box' });
    } else {
      rowsToObserve.add(element);
    }
  },
  beforeUnmount(element) {
    // A row scrolled out takes its focus with it: the keys stay with the list instead of falling to the page.
    if (element.contains(document.activeElement)) {
      focus();
      emit('rowFocusLost', measuredKeys.get(element) ?? '');
    }

    rowsToObserve.delete(element);
    observer.unobserve(element);
  },
};

let observationHeldBack = 0;
let shownRange: AnchoredListRange = { start: 0, end: 0 };
let viewportHeight = 0;
/** What the browser says the scroll position is since we last wrote or read it: anything else is the user's. */
let knownScrollTop = 0;

watch(
  () => props.rows,
  rows => {
    model.setRows(rows);
    anchor.value = model.anchor;
    applyLayout();
  },
);

defineExpose({
  jumpTo,
  focus,
  scrollBy,
  getRowOffset,
  getRowBox,
  getViewport,
  getShownRows,
  anchor,
  firstVisibleKey,
  width,
});

onMounted(() => {
  const element = assertValue(scroller.value);
  viewportHeight = element.clientHeight - props.topRoom;
  width.value = element.clientWidth;
  observer.observe(element);
  applyLayout();
});

onBeforeUnmount(() => {
  observer.disconnect();
  cancelAnimationFrame(observationHeldBack);
});

function jumpTo(key: string, offset = 0) {
  if (model.jumpTo(key, offset)) {
    anchor.value = model.anchor;
    applyLayout();
  }
}

function scrollBy(distance: number) {
  scroller.value?.scrollBy({ top: distance, behavior: 'instant' });
}

function getRowOffset(key: string) {
  const placed = placedRows.value.find(({ row }) => row.key === key);
  return placed ? placed.top - knownScrollTop : null;
}

function getRowBox(key: string): AnchoredListShownRow<T> | null {
  const placed = placedRows.value;
  const index = placed.findIndex(({ row }) => row.key === key);
  const found = placed[index];
  if (!found) {
    return null;
  }

  const bottom = placed[index + 1]?.top ?? model.total;
  return { row: found.row, top: found.top - knownScrollTop, bottom: bottom - knownScrollTop };
}

function getViewport(): AnchoredListViewport {
  return viewport.value;
}

function getShownRows() {
  const { scrolled, height } = viewport.value;
  const placed = placedRows.value;
  const shown: AnchoredListShownRow<T>[] = [];
  for (const [index, { row, top }] of placed.entries()) {
    const bottom = (placed[index + 1]?.top ?? model.total) - scrolled;
    if (bottom > 0 && top - scrolled < height) {
      shown.push({ row, top: top - scrolled, bottom });
    }
  }

  return shown;
}

function focus() {
  focusedQuietly.value = true;
  // Not there anymore when the whole list goes with the row that had the focus.
  scroller.value?.focus({ preventScroll: true });
}

function onScroll() {
  // A scroll event may still be on its way to a list that has been unmounted.
  const scrollTop = scroller.value?.scrollTop;
  if (scrollTop === undefined || scrollTop === knownScrollTop) {
    return;
  }

  const distance = scrollTop - knownScrollTop;
  knownScrollTop = scrollTop;
  model.captureAnchor(scrollTop);
  anchor.value = model.anchor;
  showWindow(false);
  emit('userScroll', distance);
}

/** One observer call is the whole frame's observations of these elements, so it is one layout. */
function onResize(entries: ResizeObserverEntry[]) {
  const element = assertValue(scroller.value);
  width.value = element.clientWidth;
  // A list that is not displayed reports every row at 0: that says nothing about the rows.
  const height = element.clientHeight;
  if (height === 0) {
    return;
  }

  let changed = height - props.topRoom !== viewportHeight;
  viewportHeight = height - props.topRoom;
  for (const entry of entries) {
    const key = measuredKeys.get(entry.target);
    const size = entry.borderBoxSize[0];
    if (key !== undefined && size !== undefined && model.setMeasuredHeight(key, size.blockSize)) {
      changed = true;
    }
  }

  if (changed) {
    applyLayout();
    holdBackObservation();
  }
}

/**
 * Rows this layout brings in are drawn before the browser leaves its resize loop; observing them right away would have
 * it report "ResizeObserver loop completed with undelivered notifications". They wait for the next frame, whose
 * rendering delivers them before anything is painted from their measurements.
 */
function holdBackObservation() {
  if (observationHeldBack !== 0) {
    return;
  }

  observationHeldBack = requestAnimationFrame(() => {
    observationHeldBack = 0;
    for (const element of rowsToObserve) {
      observer.observe(element, { box: 'border-box' });
    }

    rowsToObserve.clear();
  });
}

/**
 * Puts the anchor back where it belongs after the heights or the rows changed. The spacer comes first, as the browser
 * clamps a position to what it can scroll to at the moment of writing; while the anchor is out of reach it is kept as
 * asked, and each later layout tries again.
 */
function applyLayout() {
  const element = assertValue(scroller.value);
  const total = model.total;
  assertValue(spacer.value).style.height = `${total}px`;

  const scrollTop = Math.min(Math.max(model.anchorScrollTop, 0), Math.max(total - viewportHeight, 0));
  if (Math.abs(scrollTop - knownScrollTop) > SCROLL_EPSILON) {
    element.scrollTop = scrollTop;
    // Read back: the browser rounds the position to its pixels, and the scroll event to come must not look like the user's.
    knownScrollTop = element.scrollTop;
  }

  showWindow(true);
}

function showWindow(layoutChanged: boolean) {
  const range = model.rangeBetween(knownScrollTop - OVERSCAN, knownScrollTop + viewportHeight + OVERSCAN);
  if (layoutChanged || range.start !== shownRange.start || range.end !== shownRange.end) {
    shownRange = range;
    placedRows.value = model.placeRows(range);
  }

  const pinned = model.pinnedAt(knownScrollTop);
  if (layoutChanged || pinned?.index !== pinnedRow.value?.index || pinned?.pushUp !== pinnedRow.value?.pushUp) {
    pinnedRow.value = pinned;
  }

  firstVisibleKey.value = model.firstVisibleRow(knownScrollTop)?.key ?? null;
  viewport.value = {
    height: viewportHeight,
    covered: model.coveredAt(knownScrollTop),
    scrolled: knownScrollTop,
    remaining: Math.max(model.total - viewportHeight - knownScrollTop, 0),
  };
}
</script>

<template>
  <div
    ref="scroller"
    :class="[css.anchoredList, focusedQuietly && css.anchoredList_quiet]"
    role="region"
    :aria-label="label"
    :style="{ '--anchored-list-top-room': `${topRoom}px`, '--anchored-list-inset': `${inset}px` }"
    tabindex="0"
    @blur="focusedQuietly = false"
    @scroll.passive="onScroll"
  >
    <!-- Sticky, of no height: it stays out of the scroll height and off the scrollbar. -->
    <div
      v-if="pinnedRow"
      :class="css.anchoredList_pin"
    >
      <div
        :key="pinnedRow.row.key"
        v-measured="pinnedRow.row.key"
        :class="css.anchoredList_pinnedRow"
        :style="{ top: `${topRoom - pinnedRow.pushUp}px` }"
      >
        <AnchoredListCell
          :row="pinnedRow.row"
          :pushed="pinnedRow.pushUp > 0"
          :pinned="true"
          :render="slots.default"
        />
      </div>
    </div>
    <div
      ref="spacer"
      :class="css.anchoredList_spacer"
    >
      <div
        v-for="placed in placedRows"
        :key="placed.row.key"
        v-measured="placed.row.key"
        :class="css.anchoredList_row"
        :style="{ top: `${placed.top}px` }"
      >
        <AnchoredListCell
          :row="placed.row"
          :pushed="false"
          :pinned="false"
          :render="slots.default"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.anchoredList {
  @include focus-ring;

  position: relative;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  // The browser's own anchoring would fight ours.
  overflow-anchor: none;

  // Inside the scroller, which clips what is drawn outside it.
  &:focus-visible {
    outline-offset: -2px;
  }
}

.anchoredList_quiet:focus-visible {
  outline: none;
}

.anchoredList_spacer {
  position: relative;
  margin-top: var(--anchored-list-top-room);
  // Its height is set, and rows come and go inside it: their layout has no business outside.
  contain: strict;
}

.anchoredList_row,
.anchoredList_pinnedRow {
  position: absolute;
  right: var(--anchored-list-inset);
  left: var(--anchored-list-inset);
}

.anchoredList_pin {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 0;
}

.anchoredList_pinnedRow {
  background: $color-bg;

  // The top room, going up with the overlay when it is pushed; outside its box, which measures the row.
  &::before {
    position: absolute;
    right: 0;
    bottom: 100%;
    left: 0;
    height: var(--anchored-list-top-room);
    content: '';
    background: $color-bg;
  }
}
</style>
