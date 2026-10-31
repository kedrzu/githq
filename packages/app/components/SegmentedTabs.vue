<!-- One choice out of a few, side by side (reka-ui's single `ToggleGroup`): my work's filter "All / Needs me / Waiting on others", the List / Board layout. Each option is a toggle button (`aria-pressed`); Tab reaches the chosen one and ←/→ move between them. The choice can't be cleared, only changed. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** One option of `SegmentedTabs`. */
export interface SegmentedTabsOption<T extends string> {
  value: T;
  /** Shown, or with `iconOnly` the option's accessible name. */
  label: string;
  icon?: LucideIcon;
  /** The icon alone, `label` read out only (List / Board). */
  iconOnly?: boolean;
  disabled?: boolean;
  /** The option's key ("1"), for `aria-keyshortcuts`; the caller handles the key. */
  keyshortcuts?: string;
  /** How many it holds, dim after the label ("Repositories 15"). */
  count?: number;
}
</script>

<script lang="ts" setup generic="T extends string">
import type { AcceptableValue } from 'reka-ui';
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';

const props = withDefaults(
  defineProps<{
    options: readonly SegmentedTabsOption<T>[];
    /** The group's accessible name ("Filters"). */
    label: string;
    /** `plain`: text tabs, the chosen one raised (filters); `boxed`: icons in an outlined box (layout). */
    variant?: 'boxed' | 'plain';
  }>(),
  { variant: 'plain' },
);

const model = defineModel<T>({ required: true });

// reka-ui clears a single toggle group when its chosen item is pressed again; that is ignored here.
function choose(value: AcceptableValue | AcceptableValue[] | undefined) {
  const option = props.options.find(candidate => candidate.value === value);
  if (option) {
    model.value = option.value;
  }
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    :class="[css.segmentedTabs, css[`segmentedTabs_${variant}`]]"
    @update:model-value="choose"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
      :aria-label="option.iconOnly ? option.label : undefined"
      :aria-keyshortcuts="option.keyshortcuts"
      :class="[css.segmentedTabs_item, option.iconOnly && css.segmentedTabs_item_icon]"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        :class="css.segmentedTabs_icon"
        aria-hidden="true"
      />
      <template v-if="!option.iconOnly">{{ option.label }}</template>
      <span
        v-if="option.count != null"
        :class="css.segmentedTabs_count"
        >{{ option.count }}</span
      >
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style lang="scss" module="css">
.segmentedTabs {
  display: flex;
  flex: none;
  align-items: center;
}

.segmentedTabs_plain {
  gap: $spacing-4;
}

.segmentedTabs_boxed {
  gap: $spacing-2;
  padding: $spacing-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.segmentedTabs_item {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: 3px 8px;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg-2;
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-radius: $radius-md;

  &:hover {
    color: $color-fg;
  }

  &[data-state='on'] {
    color: $color-fg;
    background: $color-bg-3;
    border-color: $color-border-2;
  }

  &:disabled {
    color: $color-fg-3;
    cursor: default;
  }

  .segmentedTabs_boxed & {
    border: none;
    border-radius: $radius-sm;
  }
}

.segmentedTabs_item_icon {
  padding: 3px 6px;
}

.segmentedTabs_icon {
  width: 14px;
  height: 14px;
}
.segmentedTabs_count {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
