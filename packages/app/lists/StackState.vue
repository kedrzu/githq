<!-- A stack's pips and its state in words (D5, D6, SP14) from facts already worked out (`useStackFacts`): what a stack's row, its card and an issue serving as its header (stacked PRs D12) show. A share's own pips drawn in their state, the others hollow (SP24). On a card the icon is smaller and the sentence clipped to the card's width. Two siblings: the gap between them is the parent's. -->
<script lang="ts" setup>
import type { StackPip } from '@/store/stacks/describeStack.js';

import StackPips from './StackPips.vue';
import StackTone from './StackTone.vue';
import type { StackStateFact } from './useStackFacts.js';

withDefaults(
  defineProps<{
    pips: readonly StackPip[];
    /** The share's own pull requests, drawn in their state (`StackPips`); `null` for all. */
    filled?: ReadonlySet<string> | null;
    state: StackStateFact;
    /** On a board's card: a 12px icon, the sentence clipped rather than kept whole. */
    compact?: boolean;
  }>(),
  { filled: null, compact: false },
);
</script>

<template>
  <StackPips
    :pips="pips"
    :filled="filled"
  />
  <StackTone
    :look="state"
    :class="[css.stackState, compact && css.stackState_compact]"
  >
    {{ state.text }}
  </StackTone>
</template>

<style lang="scss" module="css">
.stackState {
  --stack-tone-icon-size: 12.5px;

  flex: none;
  gap: $spacing-5;
}

.stackState_compact {
  --stack-tone-icon-size: 12px;

  flex: initial;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
</style>
