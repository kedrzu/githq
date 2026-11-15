<!-- A keyboard-first list to pick from, inline (reka-ui's `Listbox`): an optional filter field on top — type to narrow, ↑/↓ to move (wrapping at the ends), Enter to pick — rows in groups under their headings, a quiet line under them, and a footer of keyboard hints. The rows are the caller's (its slot draws each); with a filter the best match is highlighted as the rows change, the highlight staying as the pointer leaves the list, and Enter typed before the highlight caught up picks it. `Picker` puts it in a popover, or on a phone in a menu at the bottom (`touch`: rows a finger's height, and the list, not the filter, takes the focus, so no on-screen keyboard comes until the filter is tapped); the command menu and the new issue's choosers show it in place. Or rising from below (`fromBelow`, a phone's command menu, mobile D16): the filter under the rows, nothing focusing it until it is tapped — the list holds the focus, the highlighted row its active descendant — the row nearest the filter highlighted as the rows change; ↑/↓ follow the screen, and a key typed while the list holds the focus goes into the filter, focusing it. -->
<script lang="ts" setup generic="TRow extends FilterListRow">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ListboxContent, ListboxFilter, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxRoot } from 'reka-ui';
import type { AcceptableValue } from 'reka-ui';
import { computed, nextTick, onMounted, useId, useTemplateRef, watch } from 'vue';

import * as l from './FilterList.loc.js';
import Kbd from './Kbd.vue';

/** A row of the list: its value, which picking it gives. */
export interface FilterListRow {
  /** Unique within the list. */
  readonly value: string;
  /** Shown, not picked (a repository that won't take an issue). */
  readonly disabled?: boolean;
  /** In a list of several values: whether it is chosen (`aria-checked`). */
  readonly checked?: boolean | 'mixed';
}

/** Rows under one heading; rows of no heading have `null`. */
export interface FilterListGroup<TRow extends FilterListRow> {
  readonly key: string;
  readonly heading: string | null;
  readonly rows: readonly TRow[];
}

/** A key the footer names, after "↑↓ Move" ("↵ Choose"). */
export interface FilterListHint {
  /** In the app's notation (`Enter`). */
  readonly keys: string;
  readonly label: string;
}

/** What the list calls on reka-ui's `ListboxRoot`. */
interface ListboxHandle {
  highlightFirstItem(): void;
  highlightItem(value: string): void;
  readonly highlightedElement: HTMLElement | null;
}

const props = withDefaults(
  defineProps<{
    /** The list's name, for assistive technology. */
    label: string;
    groups: readonly FilterListGroup<TRow>[];
    /** A filter field on top; without it the list takes the keys as it shows. */
    filterable?: boolean;
    placeholder?: string;
    /** The filter's name; the placeholder when not given. */
    filterLabel?: string;
    /** Several values are toggled (`v-model` an array); else picking a row sets it. */
    multiple?: boolean;
    /** A quiet line under the rows ("Nothing matches", "Searching GitHub…"); the caller says when. */
    message?: string | null;
    /** The heading over {@link message}, for a list that keeps its heading while it lists nothing. */
    messageHeading?: string | null;
    /** The footer's keys after "↑↓ Move"; no footer when not given. */
    hints?: readonly FilterListHint[];
    /** Escape goes back (`back`) instead of closing what the list is in. */
    backOnEscape?: boolean;
    /**
     * `sm` in a popover, `md` in a dialog, `lg` as a dialog of its own (the command menu), `touch` in a phone's menu at
     * the bottom (mobile D45): rows a finger's height, and the list holds the focus until the filter is tapped.
     */
    size?: 'lg' | 'md' | 'sm' | 'touch';
    /**
     * The filter under the rows, which the caller orders nearest-first from the bottom (a phone's command menu): the
     * last row is highlighted as the rows change, and the list, not the filter, takes the focus, so no on-screen
     * keyboard comes until the filter is tapped.
     */
    fromBelow?: boolean;
  }>(),
  {
    filterable: true,
    placeholder: undefined,
    filterLabel: undefined,
    message: null,
    messageHeading: null,
    hints: undefined,
    size: 'md',
  },
);

const emit = defineEmits<{
  /** A key pressed in the filter, before the list handles it. */
  filterKeydown: [event: KeyboardEvent];
  /** Escape, with `backOnEscape`. */
  back: [];
}>();

defineSlots<{
  /** A row's content. */
  row(props: { row: TRow; highlighted: boolean }): unknown;
  /** Above everything, in place of the filter or over it. */
  header?(): unknown;
  /** In the filter's line, before the field (a search icon, the command menu's chips). */
  beforeFilter?(): unknown;
  /** In the filter's line, after the field (a phone's close button). */
  afterFilter?(): unknown;
  /** Between the list and the footer (a quiet note). */
  afterList?(): unknown;
  /** At the footer's end, after the hints. */
  footerEnd?(): unknown;
}>();

/** The value picked (one value), or the values chosen (several); picking the same row twice emits it twice. */
const model = defineModel<AcceptableValue | AcceptableValue[]>({ default: null });
const query = defineModel<string>('query', { default: '' });
/** The highlighted row's value. */
const highlighted = defineModel<string | null>('highlighted', { default: null });

const t = useTranslate();
const listId = useId();
const rootRef = useTemplateRef<ListboxHandle>('root');
const listRef = useTemplateRef<HTMLElement>('list');
const filterRef = useTemplateRef<HTMLElement>('filter');
/** The highlight moved since the rows last changed: it is on one of them by the user's or the list's choice. */
let highlightCurrent = false;

const rows = computed(() => props.groups.flatMap(group => group.rows));
/** The list, not the filter, takes the focus as it shows, so that no on-screen keyboard comes before a tap. */
const listHoldsFocus = computed(() => props.fromBelow || props.size === 'touch');
/** Read out as the highlighted row while the list, not the filter, holds the focus. */
const activeDescendant = computed(() => (listHoldsFocus.value ? rootRef.value?.highlightedElement?.id : undefined));

// The best match is the one Enter picks: the first row, or from below the last, nearest the filter.
watch(
  () => (props.filterable ? rows.value.map(row => row.value).join('\n') : null),
  values => {
    highlightCurrent = false;
    if (values !== null) {
      void nextTick(highlightBest);
    }
  },
  { immediate: true },
);

onMounted(() => {
  // Without a filter the list takes the keys at once: ↓ highlights the first row. From below or on a phone it holds the
  // focus too, so that no on-screen keyboard comes up before the filter is tapped.
  if (!props.filterable || listHoldsFocus.value) {
    void nextTick(() => listRef.value?.querySelector<HTMLElement>('[role="listbox"]')?.focus());
  }

  // reka-ui highlights the first row once its list has mounted, a few ticks on; from below, the last one after it.
  if (props.fromBelow) {
    setTimeout(highlightLast);
  }
});

function highlightBest() {
  if (props.fromBelow) {
    // After reka-ui's own highlight of the first row, which the filter's input asks for a tick on.
    void nextTick(highlightLast);
  } else {
    rootRef.value?.highlightFirstItem();
  }
}

function highlightLast() {
  const last = rows.value.findLast(row => !row.disabled);
  if (last) {
    rootRef.value?.highlightItem(last.value);
  }
}

/** The list's own focus would highlight its first row: from below the highlight stays where it was put. */
function onEntryFocus(event: Event) {
  if (props.fromBelow) {
    event.preventDefault();
  }
}

/**
 * The pointer leaving the list clears reka-ui's highlight — also when the rows shrink out from under a pointer at rest
 * as text is typed. With a filter the highlight stays, on the row Enter picks.
 */
function onLeave(event: Event) {
  if (props.filterable && event.type === 'pointerleave' && highlighted.value !== null) {
    rootRef.value?.highlightItem(highlighted.value);
  }
}

function isInFilter(event: KeyboardEvent) {
  return event.target instanceof Node && filterRef.value?.contains(event.target) === true;
}

function onHighlight(payload: { value: AcceptableValue } | undefined) {
  highlighted.value = typeof payload?.value === 'string' ? payload.value : null;
  highlightCurrent = true;
}

/**
 * Enter in the filter picks the highlighted row — or, typed before the list moved its highlight to the best match
 * of what was just typed, the best match. Taken before the list sees it, so one Enter never picks two rows.
 */
function onEnter(event: KeyboardEvent) {
  if (!props.filterable || props.multiple || event.isComposing) {
    return;
  }

  const enabled = rows.value.filter(row => !row.disabled);
  const best = props.fromBelow ? enabled.at(-1) : enabled[0];
  const target = highlightCurrent ? enabled.find(row => row.value === highlighted.value) : best;
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    model.value = target.value;
  }
}

/**
 * ↑ on the first enabled row goes to the last, ↓ on the last to the first (reka-ui's list stops at the ends). Anywhere
 * else the list moves the highlight itself — except while a filter is shown and the list holds the focus (`fromBelow`),
 * where reka-ui moves nothing, so the move is made here. Taken before the list sees it, so one key never moves twice.
 */
function onArrow(event: KeyboardEvent) {
  if (event.isComposing || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
    return;
  }

  const enabled = rows.value.filter(row => !row.disabled);
  const step = event.key === 'ArrowUp' ? -1 : 1;
  const index = enabled.findIndex(row => row.value === highlighted.value);
  const atEnd = step < 0 ? index === 0 : index === enabled.length - 1;
  if (!atEnd && (!props.filterable || isInFilter(event))) {
    return;
  }

  const to = enabled[(index + step + enabled.length) % enabled.length];
  if (to) {
    event.preventDefault();
    event.stopPropagation();
    rootRef.value?.highlightItem(to.value);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.backOnEscape) {
    event.preventDefault();
    event.stopPropagation();
    emit('back');
    return;
  }

  if (props.filterable && !isInFilter(event)) {
    onListKeydown(event);
  }
}

/**
 * A key pressed while the list, not the filter, holds the focus: a character goes into the filter, focusing it; the
 * rest is the filter's to handle (⌫ and ← stepping back, Space with nothing typed toggling the highlighted row).
 */
function onListKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.defaultPrevented) {
    return;
  }

  const spaceWithNothingTyped = event.key === ' ' && query.value === '';
  if (event.key.length === 1 && !spaceWithNothingTyped && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    query.value += event.key;
    filterRef.value?.querySelector('input')?.focus();
    return;
  }

  emit('filterKeydown', event);
}
</script>

<template>
  <ListboxRoot
    ref="root"
    v-model="model"
    :class="[css.filterList, css[`filterList_${size}`], fromBelow && css.filterList_fromBelow]"
    :multiple="multiple"
    :selection-behavior="multiple ? 'toggle' : 'replace'"
    highlight-on-hover
    @entry-focus="onEntryFocus"
    @highlight="onHighlight"
    @leave="onLeave"
    @keydown="onKeydown"
    @keydown.enter.capture="onEnter"
  >
    <slot name="header" />
    <div
      v-if="filterable"
      ref="filter"
      :class="css.filterList_input"
      @keydown.capture="onArrow"
    >
      <slot name="beforeFilter" />
      <ListboxFilter
        v-model="query"
        :class="css.filterList_filter"
        :placeholder="placeholder"
        :aria-label="filterLabel ?? placeholder"
        :aria-controls="listId"
        :auto-focus="!listHoldsFocus"
        @keydown="emit('filterKeydown', $event)"
      />
      <slot name="afterFilter" />
    </div>
    <div
      ref="list"
      :class="css.filterList_scroll"
      @keydown.capture="onArrow"
    >
      <ListboxContent
        :id="listId"
        :class="css.filterList_list"
        :aria-label="label"
        :aria-activedescendant="activeDescendant"
      >
        <ListboxGroup
          v-for="group in groups"
          :key="group.key"
        >
          <ListboxGroupLabel
            v-if="group.heading"
            :class="css.filterList_heading"
            >{{ group.heading }}</ListboxGroupLabel
          >
          <ListboxItem
            v-for="row in group.rows"
            :key="`${group.key}:${row.value}`"
            :value="row.value"
            :disabled="row.disabled"
            :aria-disabled="row.disabled || undefined"
            :class="[css.filterList_row, row.disabled && css.filterList_row_disabled]"
            :aria-checked="multiple ? row.checked : undefined"
          >
            <slot
              name="row"
              :row="row"
              :highlighted="highlighted === row.value"
            />
          </ListboxItem>
        </ListboxGroup>
      </ListboxContent>
      <!-- Outside the listbox, which may hold only its options. -->
      <div
        v-if="message"
        :class="css.filterList_status"
      >
        <p
          v-if="messageHeading"
          :class="css.filterList_heading"
        >
          {{ messageHeading }}
        </p>
        <p :class="css.filterList_message">
          {{ message }}
        </p>
      </div>
    </div>
    <slot name="afterList" />
    <footer
      v-if="hints"
      :class="[css.filterList_footer, $slots.footerEnd && css.filterList_footer_withEnd]"
      aria-hidden="true"
    >
      <span :class="css.filterList_hint"><Kbd keys="ArrowUp ArrowDown" />{{ t(l.move) }}</span>
      <span
        v-for="hint in hints"
        :key="hint.keys"
        :class="css.filterList_hint"
        ><Kbd :keys="hint.keys" />{{ hint.label }}</span
      >
      <span :class="css.filterList_spacer" />
      <span
        v-if="$slots.footerEnd"
        :class="css.filterList_footerEnd"
        ><slot name="footerEnd"
      /></span>
    </footer>
  </ListboxRoot>
</template>

<style lang="scss" module="css">
.filterList {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filterList_input {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  border-bottom: 1px solid $color-border;
}

.filterList_filter {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: $color-fg;
  background: none;
  border: none;
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
  }
}

.filterList_scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filterList_list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  outline: none;
}

.filterList_heading {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.filterList_row {
  display: flex;
  flex: none;
  align-items: center;
  cursor: pointer;
  outline: none;
}

.filterList_row_disabled {
  color: $color-fg-dim;
  cursor: default;
}

.filterList_status {
  flex: none;
}

.filterList_message {
  color: $color-fg-dim;
}

.filterList_footer {
  display: flex;
  flex: none;
  gap: 14px;
  align-items: center;
  padding: $spacing-8 14px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.filterList_hint {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
}

.filterList_spacer {
  flex: 1;
}

// A note at the end that doesn't fit beside the hints takes a line of its own, at the end, rather than breaking them.
.filterList_footer_withEnd {
  flex-wrap: wrap;
  row-gap: $spacing-4;

  .filterList_hint {
    white-space: nowrap;
  }
}

.filterList_footerEnd {
  margin-inline-start: auto;
  white-space: nowrap;
}

// In a popover: the picker's.
.filterList_sm {
  gap: $spacing-6;

  .filterList_input {
    padding: $spacing-6 $spacing-8;
  }

  .filterList_filter {
    font-size: $font-size-md;
  }

  .filterList_list {
    max-height: 280px;
  }

  .filterList_heading {
    padding: $spacing-6 $spacing-8 $spacing-2;
  }

  .filterList_row {
    gap: $spacing-8;
    min-height: 28px;
    padding: $spacing-4 $spacing-8;
    border-radius: $radius-md;

    &[data-highlighted] {
      background: $color-bg-3;
    }
  }

  .filterList_message {
    padding: $spacing-4 $spacing-8;
    font-size: $font-size-xs;
  }
}

// In a dialog, and the command menu.
.filterList_md,
.filterList_lg {
  .filterList_list {
    padding: $spacing-6;

    &:empty {
      padding: 0;
    }
  }

  .filterList_status {
    padding: 0 $spacing-6 $spacing-6;
  }

  .filterList_row {
    gap: $spacing-10;
    min-height: 30px;
    padding: 6px $spacing-10;
    font-size: $font-size-md;
    border-radius: 7px;

    &[data-highlighted] {
      @include row-selected-surface;
    }
  }

  .filterList_message {
    padding: $spacing-8 $spacing-10;
    font-size: $font-size-sm;
  }
}

.filterList_md {
  .filterList_input {
    padding: $spacing-10 14px;
  }

  .filterList_filter {
    font-size: $font-size-md;
  }

  .filterList_list {
    max-height: 320px;
  }

  .filterList_heading {
    padding: $spacing-8 $spacing-10 $spacing-4;
  }
}

.filterList_lg {
  .filterList_input {
    padding: $spacing-12 14px;
  }

  .filterList_filter {
    font-size: $font-size-xl;
  }

  .filterList_scroll {
    flex: 1;
  }

  .filterList_list {
    flex: 1;
    min-height: 0;
  }

  .filterList_heading {
    padding: $spacing-10 $spacing-10 $spacing-4;
  }

  .filterList_row {
    padding: 7px $spacing-10;
  }
}

// From below (a phone's command menu): the filter's line at the bottom, under the rows, which are a thumb's height and
// read at a phone's size (MB223); the filter's text as large as keeps iOS from zooming into it.
.filterList_fromBelow {
  .filterList_input {
    order: 1;
    min-height: $touch-target-size;
    padding-block: $spacing-4;
    border-top: 1px solid $color-border;
    border-bottom: none;
  }

  .filterList_filter {
    font-size: $font-size-phone-input;
  }

  .filterList_row {
    min-height: $touch-target-size;
    font-size: $font-size-xl;
  }
}

// In a phone's menu at the bottom (MB74, MB108): the filter a field of its own under the sheet's head, the rows a
// thumb's height running to the sheet's edges.
.filterList_touch {
  .filterList_input {
    @include sheet-filter-field;
  }

  .filterList_filter {
    font-size: $font-size-phone-input;
  }

  .filterList_list {
    flex: 1;
    min-height: 0;
    border-top: 1px solid $color-border;
  }

  .filterList_scroll {
    flex: 1;
  }

  .filterList_heading {
    padding: $spacing-12 $spacing-20 $spacing-4;
  }

  .filterList_row {
    gap: $spacing-12;
    min-height: $touch-target-size;
    padding: $spacing-6 $spacing-20;
    font-size: $font-size-xl;

    &[data-highlighted] {
      background: $color-bg-3;
    }
  }

  .filterList_message {
    padding: $spacing-12 $spacing-20;
    font-size: $font-size-md;
  }
}
</style>
