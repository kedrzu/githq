<!-- A stack's pips and its state in words (D5, D6, SP14), worked out as for its entry (`useStackFacts`): what an issue serving as a stack's header shows after its number in my work (stacked PRs D12, SP20, SP21). -->
<script lang="ts" setup>
import type { ListStack } from './ListTypes.js';
import StackPips from './StackPips.vue';
import { useStackFacts } from './useStackFacts.js';

const props = defineProps<{
  stack: ListStack;
  /** Epoch ms the stack's age is counted to. */
  now: number;
  /** The signed-in user. */
  viewerLogin: string | null;
}>();

const stackFacts = useStackFacts({
  stack: () => props.stack,
  now: () => props.now,
  people: 'author',
  viewerLogin: () => props.viewerLogin,
});
</script>

<template>
  <StackPips
    :pips="stack.description.pips"
    :filled="stackFacts.filled"
  />
  <span :class="[css.stackSummary_state, css[`stackSummary_state_${stackFacts.state.tone}`]]">
    <component
      :is="stackFacts.state.icon"
      :class="css.stackSummary_stateIcon"
      aria-hidden="true"
    />
    {{ stackFacts.state.text }}
  </span>
</template>

<style lang="scss" module="css">
// As `StackRow`'s state.
.stackSummary_state {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
}

.stackSummary_state_danger {
  color: $color-red;
}

.stackSummary_state_warning {
  color: $color-amber;
}

.stackSummary_state_success {
  color: $color-green;
}

.stackSummary_state_done {
  color: $color-purple;
}

.stackSummary_state_muted {
  color: $color-fg-2;
}

.stackSummary_state_dim {
  color: $color-fg-dim;
}

.stackSummary_stateIcon {
  width: 12.5px;
  height: 12.5px;
}
</style>
