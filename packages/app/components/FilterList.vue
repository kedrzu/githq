<!-- A keyboard-first list to pick from, inline (reka-ui's `Listbox`): an optional filter field on top — type to narrow, ↑/↓ to move, Enter to pick — rows in groups under their headings, a quiet line under them, and a footer of keyboard hints. The rows are the caller's (its slot draws each); with a filter the best match is highlighted as the rows change, and Enter typed before the highlight caught up picks it. `Picker` puts it in a popover; the command menu and the new issue's choosers show it in place. -->
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
  readonly keys: string;
  readonly label: string;
}

/** What the list calls on reka-ui's `ListboxRoot`. */
interface ListboxHandle {
  highlightFirstItem(): void;
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
    /** The footer's keys after "↑↓ Move"; no footer when not given. */
    hints?: readonly FilterListHint[];
    /** Escape goes back (`back`) instead of closing what the list is in. */
    backOnEscape?: boolean;
    /** `sm` in a popover, `md` in a dialog, `lg` as a dialog of its own (the command menu). */
    size?: 'lg' | 'md' | 'sm';
  }>(),
  {
    filterable: true,
    placeholder: undefined,
    filterLabel: undefined,
    message: null,
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
/** The highlight moved since the rows last changed: it is on one of them by the user's or the list's choice. */
let highlightCurrent = false;

const rows = computed(() => props.groups.flatMap(group => group.rows));

// The best match is the one Enter picks.
watch(
  () => (props.filterable ? rows.value.map(row => row.value).join('\n') : null),
  values => {
    highlightCurrent = false;
    if (values !== null) {
      void nextTick(() => rootRef.value?.highlightFirstItem());
    }
  },
  { immediate: true },
);

onMounted(() => {
  // Without a filter the list takes the keys at once: ↓ highlights the first row.
  if (!props.filterable) {
    void nextTick(() => listRef.value?.querySelector<HTMLElement>('[role="listbox"]')?.focus());
  }
});

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
  const target = highlightCurrent ? enabled.find(row => row.value === highlighted.value) : enabled[0];
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    model.value = target.value;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.backOnEscape) {
    event.preventDefault();
    event.stopPropagation();
    emit('back');
  }
}
</script>

<template>
  <ListboxRoot
    ref="root"
    v-model="model"
    :class="[css.filterList, css[`filterList_${size}`]]"
    :multiple="multiple"
    :selection-behavior="multiple ? 'toggle' : 'replace'"
    highlight-on-hover
    @highlight="onHighlight"
    @keydown="onKeydown"
    @keydown.enter.capture="onEnter"
  >
    <slot name="header" />
    <div
      v-if="filterable"
      :class="css.filterList_input"
    >
      <slot name="beforeFilter" />
      <ListboxFilter
        v-model="query"
        :class="css.filterList_filter"
        :placeholder="placeholder"
        :aria-label="filterLabel ?? placeholder"
        :aria-controls="listId"
        auto-focus
        @keydown="emit('filterKeydown', $event)"
      />
    </div>
    <div
      ref="list"
      :class="css.filterList_scroll"
    >
      <ListboxContent
        :id="listId"
        :class="css.filterList_list"
        :aria-label="label"
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
        <p
          v-if="message"
          :class="css.filterList_message"
        >
          {{ message }}
        </p>
      </ListboxContent>
    </div>
    <slot name="afterList" />
    <footer
      v-if="hints"
      :class="css.filterList_footer"
      aria-hidden="true"
    >
      <span :class="css.filterList_hint"><Kbd>↑↓</Kbd>{{ t(l.move) }}</span>
      <span
        v-for="hint in hints"
        :key="hint.keys"
        :class="css.filterList_hint"
        ><Kbd>{{ hint.keys }}</Kbd
        >{{ hint.label }}</span
      >
      <span :class="css.filterList_spacer" />
      <slot name="footerEnd" />
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
  }

  .filterList_row {
    gap: $spacing-10;
    min-height: 30px;
    padding: 6px $spacing-10;
    font-size: $font-size-md;
    border-radius: 7px;

    &[data-highlighted] {
      background: $color-sel;
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
</style>
