<!-- A stack's pips and its state in words (D5, D6, SP14), worked out as for its entry (`useStackFacts`): what an issue serving as a stack's header shows after its number in my work (stacked PRs D12, SP20, SP21). -->
<script lang="ts" setup>
import type { ListStack } from './ListTypes.js';
import StackState from './StackState.vue';
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
  <StackState
    :pips="stack.description.pips"
    :filled="stackFacts.filled"
    :state="stackFacts.state"
  />
</template>
