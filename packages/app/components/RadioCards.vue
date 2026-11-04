<!-- One choice out of a few, each a card the caller draws (reka-ui's `RadioGroup`). Tab reaches the chosen one and the arrow keys move between them, choosing as they go; focus arriving from anywhere else (the window refocused on a stale card) chooses nothing. -->
<script lang="ts">
import type { HTMLAttributes } from 'vue';

/** What a card of `RadioCards` needs of its option. */
interface RadioCardsOption {
  value: string;
}

/** What a card takes besides its value: its class and what names it. */
type RadioCardAttrs = Pick<HTMLAttributes, 'class' | 'aria-labelledby' | 'aria-describedby'>;
</script>

<script lang="ts" setup generic="O extends RadioCardsOption">
import type { AcceptableValue } from 'reka-ui';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';

const props = defineProps<{
  options: readonly O[];
  getCardAttrs?: (option: O) => RadioCardAttrs;
}>();

defineSlots<{
  default(props: { option: O }): unknown;
}>();

const model = defineModel<O['value']>({ required: true });

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
function chooseOnArrow(value: O['value'], event: FocusEvent) {
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
    @update:model-value="choose"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      v-bind="getCardAttrs?.(option)"
      :value="option.value"
      @focus="chooseOnArrow(option.value, $event)"
    >
      <slot :option="option" />
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
