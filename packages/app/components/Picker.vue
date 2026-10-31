<!-- A keyboard-first picker hanging from its trigger (reka-ui's `Listbox` with its filter, in a `Popover`): type to narrow the options, ↑/↓ to move, Enter to pick. One value (a milestone, a status) is set by picking it and the picker closes. Several (labels, assignees) are toggled with Enter or Space, and applied together when it closes — Escape or a click outside — as what was added and removed. Options carry a colour dot or an avatar, a dim detail, and may sit in groups; one chosen on only some of several items shows half-chosen until toggled. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Minus } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { computed, ref, watch } from 'vue';

import Avatar from './Avatar.vue';
import FilterList from './FilterList.vue';
import type { FilterListGroup, FilterListRow } from './FilterList.vue';
import * as l from './Picker.loc.js';
import Popover from './Popover.vue';

/** One thing to pick. */
export interface PickerOption {
  readonly value: string;
  readonly label: string;
  /** Dim text after the label ("due Nov 2", "current"). */
  readonly detail?: string;
  /** A colour dot before the label, hex without `#`. */
  readonly color?: string;
  /** A user's picture before the label. */
  readonly avatarUrl?: string;
  /** The heading it sits under; options of one group follow each other. */
  readonly group?: string;
}

/** A line of the list: an option, or the "none" one (`option: null`). */
interface PickerRow extends FilterListRow {
  readonly option: PickerOption | null;
}

/** What a picker of several values changed when it closed. */
export interface PickerChange {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

const props = withDefaults(
  defineProps<{
    /** Its name: the panel's, and the list's ("Labels"). */
    label: string;
    options: readonly PickerOption[];
    /** Several values are toggled and applied together on close. */
    multiple?: boolean;
    /** The values chosen when it opens. */
    selected?: readonly string[];
    /** Values chosen on only some of the items it edits: half-chosen until toggled. */
    mixed?: readonly string[];
    /** The filter's placeholder. */
    placeholder?: string;
    /** One value: an option first that clears it ("No milestone"). */
    noneLabel?: string;
    /** A quiet line under the list ("2 of 3 editable"). */
    note?: string;
    align?: 'center' | 'end' | 'start';
  }>(),
  {
    selected: () => [],
    mixed: () => [],
    placeholder: undefined,
    noneLabel: undefined,
    note: undefined,
    align: 'start',
  },
);

const emit = defineEmits<{
  /** One value picked; `null` for the "none" option. */
  pick: [value: string | null];
  /** Several values: what was added and removed, emitted on close when anything changed. */
  apply: [change: PickerChange];
}>();

defineSlots<{
  /** The trigger: one button, which gets the popover's handlers and ARIA. */
  trigger(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });

/** The value of the "none" option, which no real value takes. */
const NONE = '\u0000none';

const t = useTranslate();
const query = ref('');
const chosen = ref<string[]>([]);
const touched = ref<ReadonlySet<string>>(new Set());

const groups = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const options = needle
    ? props.options.filter(
        option =>
          option.label.toLowerCase().includes(needle) || (option.detail?.toLowerCase().includes(needle) ?? false),
      )
    : props.options;
  const grouped: { key: string; heading: string | null; rows: PickerRow[] }[] = [];
  if (!props.multiple && props.noneLabel !== undefined && !needle) {
    grouped.push({ key: NONE, heading: null, rows: [{ value: NONE, option: null }] });
  }

  for (const option of options) {
    const heading = option.group ?? null;
    const row: PickerRow = {
      value: option.value,
      option,
      checked: isMixed(option.value) ? 'mixed' : chosen.value.includes(option.value),
    };
    const last = grouped.at(-1);
    if (last && last.key !== NONE && last.heading === heading) {
      last.rows.push(row);
    } else {
      grouped.push({ key: `${grouped.length}:${heading ?? ''}`, heading, rows: [row] });
    }
  }

  return grouped satisfies FilterListGroup<PickerRow>[];
});
const model = computed({
  get: (): AcceptableValue | AcceptableValue[] =>
    props.multiple ? chosen.value : (chosen.value[0] ?? (props.noneLabel === undefined ? null : NONE)),
  set: value => {
    if (Array.isArray(value)) {
      toggleTo(value.filter(item => typeof item === 'string'));
    } else if (typeof value === 'string') {
      pick(value);
    }
  },
});

watch(open, (isOpen, wasOpen) => {
  if (isOpen) {
    query.value = '';
    chosen.value = [...props.selected];
    touched.value = new Set();
  } else if (wasOpen && props.multiple) {
    applyChanges();
  }
});

function isMixed(value: string) {
  return props.mixed.includes(value) && !touched.value.has(value) && !chosen.value.includes(value);
}

/** Several values: the list's new selection; what differs from before is now the user's. */
function toggleTo(values: string[]) {
  const next = new Set(touched.value);
  for (const value of new Set([...values, ...chosen.value])) {
    if (values.includes(value) !== chosen.value.includes(value)) {
      next.add(value);
    }
  }

  touched.value = next;
  chosen.value = values;
}

function pick(value: string) {
  emit('pick', value === NONE ? null : value);
  open.value = false;
}

function applyChanges() {
  const added: string[] = [];
  const removed: string[] = [];
  for (const value of touched.value) {
    const now = chosen.value.includes(value);
    // Back where it was on every item: no change.
    if (now && !props.selected.includes(value)) {
      added.push(value);
    } else if (!now && (props.selected.includes(value) || props.mixed.includes(value))) {
      removed.push(value);
    }
  }

  if (added.length > 0 || removed.length > 0) {
    emit('apply', { added, removed });
  }
}

/** Space toggles the highlighted option while nothing is typed; once something is, it is part of the filter. */
function onFilterKeydown(event: KeyboardEvent) {
  if (event.key !== ' ' || query.value !== '' || !(event.target instanceof HTMLElement)) {
    return;
  }

  const highlighted = event.target.getAttribute('aria-activedescendant');
  const option = highlighted ? document.querySelector(`#${CSS.escape(highlighted)}`) : null;
  if (option instanceof HTMLElement) {
    event.preventDefault();
    option.click();
  }
}
</script>

<template>
  <Popover
    v-model:open="open"
    :label="label"
    :align="align"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <FilterList
      v-model="model"
      v-model:query="query"
      :class="css.picker"
      :label="label"
      :groups="groups"
      :multiple="multiple"
      :placeholder="placeholder ?? t(l.filter)"
      :message="groups.length === 0 ? t(l.noMatch) : null"
      size="sm"
      @filter-keydown="onFilterKeydown"
    >
      <template #row="{ row }">
        <template v-if="row.option === null">
          <span :class="[css.picker_label, css.picker_none]">{{ noneLabel }}</span>
          <Check
            v-if="chosen.length === 0"
            :class="css.picker_check"
            aria-hidden="true"
          />
        </template>
        <template v-else>
          <span
            v-if="multiple"
            :class="[css.picker_box, row.checked !== false && css.picker_box_on]"
            aria-hidden="true"
          >
            <Check
              v-if="row.checked === true"
              :class="css.picker_mark"
            />
            <Minus
              v-else-if="row.checked === 'mixed'"
              :class="css.picker_mark"
            />
          </span>
          <span
            v-if="row.option.color"
            :class="css.picker_dot"
            :style="{ background: `#${row.option.color}` }"
            aria-hidden="true"
          />
          <Avatar
            v-if="row.option.avatarUrl"
            :name="row.option.label"
            :src="row.option.avatarUrl"
            size="xs"
            decorative
          />
          <span :class="css.picker_label">{{ row.option.label }}</span>
          <span
            v-if="row.option.detail"
            :class="css.picker_detail"
            >{{ row.option.detail }}</span
          >
          <Check
            v-if="!multiple && row.checked === true"
            :class="css.picker_check"
            aria-hidden="true"
          />
        </template>
      </template>
      <template
        v-if="note"
        #afterList
      >
        <p :class="css.picker_note">
          {{ note }}
        </p>
      </template>
    </FilterList>
  </Popover>
</template>

<style lang="scss" module="css">
.picker {
  width: 280px;
  margin: -$spacing-4;
}

.picker_box {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: $color-on-light;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.picker_box_on {
  background: $color-accent;
  border-color: $color-accent;
}

.picker_mark {
  width: 11px;
  height: 11px;
}

.picker_dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.picker_label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker_none {
  color: $color-fg-2;
}

.picker_detail {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.picker_check {
  flex: none;
  width: 13px;
  height: 13px;
  margin-left: auto;
  color: $color-fg-2;
}

.picker_note {
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}
</style>
