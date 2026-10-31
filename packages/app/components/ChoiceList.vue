<!-- One choice out of a list, one option above the other (reka-ui's `RadioGroup`): the tracking choice's owners on the left. Each option is a radio with an optional icon and a dim count; Tab reaches the chosen one and ↑/↓ move between them, choosing as they go. The choice can't be cleared, only changed. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** One option of `ChoiceList`. */
export interface ChoiceListOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Dim after the label ("3/15"). */
  count?: string;
  /** What `count` reads out ("3 of 15 selected"). */
  countLabel?: string;
  /** In amber: the option needs the user's attention (an organisation hiding its private data). */
  warning?: boolean;
}
</script>

<script lang="ts" setup generic="T extends string">
import type { AcceptableValue } from 'reka-ui';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';

const props = defineProps<{
  options: readonly ChoiceListOption<T>[];
  /** The list's accessible name ("Owners"). */
  label: string;
}>();

const model = defineModel<T>({ required: true });

// An option is chosen as the focus reaches it (the radio pattern): reka-ui chooses on an arrow key only while the
// key is still held when the focus has moved, which a quick press is not. Tab lands on the chosen one anyway.
function choose(value: AcceptableValue | undefined) {
  const option = props.options.find(candidate => candidate.value === value);
  if (option) {
    model.value = option.value;
  }
}
</script>

<template>
  <RadioGroupRoot
    :model-value="model"
    :aria-label="label"
    orientation="vertical"
    :class="css.choiceList"
    @update:model-value="choose"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :class="[css.choiceList_item, option.warning && css.choiceList_item_warning]"
      @focus="choose(option.value)"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        :class="css.choiceList_icon"
        aria-hidden="true"
      />
      <span :class="css.choiceList_label">{{ option.label }}</span>
      <span
        v-if="option.count != null"
        :class="css.choiceList_count"
        :aria-label="option.countLabel"
        >{{ option.count }}</span
      >
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style lang="scss" module="css">
.choiceList {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.choiceList_item {
  @include focus-ring;

  display: flex;
  gap: 7px;
  align-items: center;
  width: 100%;
  padding: 5px 10px;
  font-family: $font-family-sans;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg-2;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;

  &:hover,
  &[data-state='checked'] {
    color: $color-fg;
    background: $color-bg-3;
  }
}

.choiceList_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;

  .choiceList_item_warning & {
    color: $color-amber;
  }
}

.choiceList_label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.choiceList_count {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;

  .choiceList_item_warning & {
    color: $color-amber;
  }
}
</style>
