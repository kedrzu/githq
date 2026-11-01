<!-- A project item's values of the fields its view shows, in a row or a card (D4, D5): a single select's option with its colour dot, an iteration, a number, a date, a text — each named by its field on hover and for screen readers. Fields without a value show nothing. Given several items — a stack's pull requests (D15) — it shows the values all of them share, then "+N" for the fields where they differ. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Repeat } from 'lucide-vue-next';
import { computed } from 'vue';

import type { ProjectField } from '@/store/ItemDetailTypes.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';

import { describeProjectFieldValue } from './describeProjectFieldValue.js';
import * as l from './ProjectEntryFields.loc.js';
import type { ProjectItem } from './ProjectTypes.js';

const props = defineProps<{
  /** One item, or the items of a stack's entry. */
  items: readonly ProjectItem[];
  /** The fields to show, in order. */
  fields: readonly ProjectField[];
}>();

/** A value as shown. */
interface ShownValue {
  readonly field: ProjectField;
  readonly text: string;
  /** A single select's colour, hex without `#`. */
  readonly color: string | null;
  readonly iteration: boolean;
}

const t = useTranslate();

const shown = computed(() => {
  const values: ShownValue[] = [];
  let differing = 0;
  for (const field of props.fields) {
    const texts = new Set(props.items.map(item => getText(item, field)));
    const [text] = texts;
    const value = props.items[0]?.values[field.id];
    if (texts.size > 1) {
      differing++;
    } else if (value && text) {
      values.push({
        field,
        text,
        color: value.kind === 'singleSelect' ? getGitHubColor(value.color) : null,
        iteration: value.kind === 'iteration',
      });
    }
  }

  return { values, more: differing > 0 ? t(l.more, { count: differing }) : null };
});

/** The item's value of the field as shown; `null` for none. */
function getText(item: ProjectItem, field: ProjectField) {
  const value = item.values[field.id];
  return value?.kind === 'date'
    ? formatShortDate(Date.parse(value.date))
    : value
      ? describeProjectFieldValue(value)
      : null;
}
</script>

<template>
  <span
    v-for="value in shown.values"
    :key="value.field.id"
    :class="css.projectEntryFields_value"
    :title="`${value.field.name}: ${value.text}`"
  >
    <span :class="css.projectEntryFields_name">{{ value.field.name }}:</span>
    <span
      v-if="value.color"
      :class="css.projectEntryFields_dot"
      :style="{ background: `#${value.color}` }"
      aria-hidden="true"
    />
    <Repeat
      v-else-if="value.iteration"
      :class="css.projectEntryFields_icon"
      aria-hidden="true"
    />
    {{ value.text }}
  </span>
  <span
    v-if="shown.more"
    :class="css.projectEntryFields_more"
    >{{ shown.more }}</span
  >
</template>

<style lang="scss" module="css">
.projectEntryFields_value {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  max-width: 180px;
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.projectEntryFields_more {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.projectEntryFields_name {
  @include visually-hidden;
}

.projectEntryFields_dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.projectEntryFields_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}
</style>
