<!-- The marker of a pull request listed alone out of its stack, or the last open one of it (D16, SP13, SP26): a stack icon, the stack's pips with its own tall — the stack's other open ones hollow — and its place, "3 of 4". Nothing for any other item. A row's or a card's; how it sits in them (inline or a line of its own) is theirs. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Layers } from 'lucide-vue-next';
import { computed } from 'vue';

import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './StackMarker.loc.js';
import StackPips from './StackPips.vue';

const props = defineProps<{
  item: Item;
  /** The stack the pull request is listed alone out of (`ListRow.stackMarker`). */
  stack: StackDescription | null;
}>();

const t = useTranslate();
/** The pull request alone in its state, the stack's other open ones hollow (SP24), and its place (SP13). */
const marker = computed(() => {
  const { item, stack } = props;
  if (!stack || item.kind !== 'pullRequest' || !item.stack) {
    return null;
  }

  return {
    pips: stack.pips,
    filled: new Set([item.id]),
    place: t(l.stackPlace, { position: item.stack.position, size: stack.size }),
  };
});
</script>

<template>
  <span
    v-if="marker"
    :class="css.stackMarker"
  >
    <Layers
      :class="css.stackMarker_icon"
      role="img"
      :aria-label="t(l.inStack)"
    />
    <StackPips
      :pips="marker.pips"
      :filled="marker.filled"
      :current="item.id"
    />
    <span :class="css.stackMarker_place">{{ marker.place }}</span>
  </span>
</template>

<style lang="scss" module="css">
.stackMarker {
  gap: $spacing-5;
  align-items: center;
}

.stackMarker_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.stackMarker_place {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}
</style>
