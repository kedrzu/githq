<!-- Several of a few, each a chip on or off (reka-ui's multiple `ToggleGroup`): the properties a list's rows show ("Repo · Priority · Labels"). Each chip is a toggle button (`aria-pressed`); Tab reaches the group, ←/→ move between chips, Space or Enter toggles one. -->
<script lang="ts">
/** One chip of `ToggleChips`. */
export interface ToggleChipsOption<T extends string> {
  value: T;
  label: string;
}
</script>

<script lang="ts" setup generic="T extends string">
import type { AcceptableValue } from 'reka-ui';
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';

const props = defineProps<{
  /** The group's accessible name ("Properties"). */
  label: string;
  options: readonly ToggleChipsOption<T>[];
}>();

const model = defineModel<readonly T[]>({ required: true });

/** The chips on, in the options' order. */
function choose(values: AcceptableValue | AcceptableValue[] | undefined) {
  const on = Array.isArray(values) ? values : [];
  model.value = props.options.filter(option => on.includes(option.value)).map(option => option.value);
}
</script>

<template>
  <ToggleGroupRoot
    type="multiple"
    :model-value="[...model]"
    :aria-label="label"
    :class="css.toggleChips"
    @update:model-value="choose"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :class="css.toggleChips_item"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style lang="scss" module="css">
.toggleChips {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6;
}

.toggleChips_item {
  @include focus-ring;

  padding: 2px 9px;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg-dim;
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border-2;
  border-radius: 10px;

  &:hover {
    color: $color-fg-2;
  }

  &[data-state='on'] {
    color: $color-fg;
    background: rgba($color-accent, 0.14);
    border-color: rgba($color-accent, 0.6);
  }
}
</style>
