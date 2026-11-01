<!-- A stack's pips and its state in words (D5, D6, SP14) from facts already worked out (`useStackFacts`): what a stack's row, its card and an issue serving as its header (stacked PRs D12) show. A share's own pips drawn in their state, the others hollow (SP24). On a card the icon is smaller and the sentence clipped to the card's width. Two siblings: the gap between them is the parent's. -->
<script lang="ts" setup>
import type { StackPip } from '@/store/stacks/describeStack.js';

import StackPips from './StackPips.vue';
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
  <span :class="[css.stackState, compact && css.stackState_compact, css[`stackState_${state.tone}`]]">
    <component
      :is="state.icon"
      :class="css.stackState_icon"
      aria-hidden="true"
    />
    {{ state.text }}
  </span>
</template>

<style lang="scss" module="css">
.stackState {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
}

.stackState_compact {
  flex: initial;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.stackState_danger {
  color: $color-red;
}

.stackState_warning {
  color: $color-amber;
}

.stackState_success {
  color: $color-green;
}

.stackState_done {
  color: $color-purple;
}

.stackState_muted {
  color: $color-fg-2;
}

.stackState_dim {
  color: $color-fg-dim;
}

.stackState_icon {
  flex: none;
  width: 12.5px;
  height: 12.5px;

  .stackState_compact & {
    width: 12px;
    height: 12px;
  }
}
</style>
