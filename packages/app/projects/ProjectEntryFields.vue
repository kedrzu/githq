<!-- A project item's values of the fields its view shows, in a row or a card (D4, D5): a single select's option with its colour dot, an iteration, a number, a date, a text — each named by its field on hover and for screen readers. Fields without a value show nothing. -->
<script lang="ts" setup>
import { Repeat } from 'lucide-vue-next';
import { computed } from 'vue';

import type { ProjectField } from '@/store/ItemDetailTypes.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';

import { describeProjectFieldValue } from './describeProjectFieldValue.js';
import type { ProjectItem } from './ProjectTypes.js';

const props = defineProps<{
  item: ProjectItem;
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

const shown = computed(() => {
  const values: ShownValue[] = [];
  for (const field of props.fields) {
    const value = props.item.values[field.id];
    const text =
      value?.kind === 'date' ? formatShortDate(Date.parse(value.date)) : value && describeProjectFieldValue(value);
    if (value && text) {
      values.push({
        field,
        text,
        color: value.kind === 'singleSelect' ? getGitHubColor(value.color) : null,
        iteration: value.kind === 'iteration',
      });
    }
  }

  return values;
});
</script>

<template>
  <span
    v-for="value in shown"
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
