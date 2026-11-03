<!-- One choice out of a few, each a card side by side (reka-ui's `RadioGroup`): the repository layout in Settings. A card holds what the caller's slot draws of the option, a radio with its label, and a line of detail. Tab reaches the chosen one and the arrow keys move between them, choosing as they go; focus arriving from anywhere else (the window refocused on a stale card) chooses nothing. The choice can't be cleared, only changed. -->
<script lang="ts">
/** One option of `ChoiceCards`. */
export interface ChoiceCardsOption<T extends string> {
  value: T;
  label: string;
  /** The line under the label, which describes the card to a screen reader too. */
  detail: string;
}
</script>

<script lang="ts" setup generic="T extends string">
import type { AcceptableValue } from 'reka-ui';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import { useId } from 'vue';

const props = defineProps<{
  options: readonly ChoiceCardsOption<T>[];
  /** The id of the heading naming the group. */
  labelledby: string;
}>();

defineSlots<{
  /** What the card shows of the option, above its label. */
  default?(props: { option: ChoiceCardsOption<T> }): unknown;
}>();

const model = defineModel<T>({ required: true });

const id = useId();

function choose(value: AcceptableValue | undefined) {
  const option = props.options.find(candidate => candidate.value === value);
  if (option) {
    model.value = option.value;
  }
}

// reka-ui chooses on an arrow key only while the key is still held when the focus has moved, which a quick press is
// not, so the arrow's move chooses here. Only that move: focus coming back with the window lands on a card that may
// be stale by now, and choosing it would overwrite what was chosen in another tab or on another device; a mouse press
// moves focus between cards too, and only the click after it chooses.
function chooseOnArrow(value: T, event: FocusEvent) {
  const from = event.relatedTarget;
  const card = event.currentTarget;
  if (!(card instanceof Element) || !(from instanceof Element) || !card.matches(':focus-visible')) {
    return;
  }

  if (from.matches('[role="radio"]') && card.closest('[role="radiogroup"]')?.contains(from)) {
    choose(value);
  }
}
</script>

<template>
  <RadioGroupRoot
    :model-value="model"
    :aria-labelledby="labelledby"
    :class="css.choiceCards"
    @update:model-value="choose"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :aria-labelledby="`${id}-${option.value}`"
      :aria-describedby="`${id}-${option.value}-detail`"
      :class="css.choiceCards_card"
      @focus="chooseOnArrow(option.value, $event)"
    >
      <slot :option="option" />
      <span :class="css.choiceCards_head">
        <span :class="css.choiceCards_radio" />
        <span
          :id="`${id}-${option.value}`"
          :class="css.choiceCards_label"
          >{{ option.label }}</span
        >
      </span>
      <span
        :id="`${id}-${option.value}-detail`"
        :class="css.choiceCards_detail"
        >{{ option.detail }}</span
      >
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style lang="scss" module="css">
.choiceCards {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: $spacing-12;
}

.choiceCards_card {
  @include focus-ring;

  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-12;
  font-family: $font-family-sans;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  &[data-state='checked'] {
    background: rgba($color-accent, 0.06);
    border-color: $color-accent;
  }
}

.choiceCards_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.choiceCards_radio {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid $color-fg-3;
  border-radius: 50%;

  [data-state='checked'] > .choiceCards_head > & {
    border-color: $color-accent;

    &::after {
      width: 6px;
      height: 6px;
      content: '';
      background: $color-accent;
      border-radius: 50%;
    }
  }
}

.choiceCards_label {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.choiceCards_detail {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}
</style>
