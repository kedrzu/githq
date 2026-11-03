<!-- Where a pull request stands, in one line: the status's icon and words in its tone, the first letter capitalised. The same in a row, a card and a stack's row; the parent gives it its place (`flex: none` or `min-width: 0`). -->
<script lang="ts" setup>
import type { ItemStatusFact } from './useItemFacts.js';

defineProps<{
  status: ItemStatusFact;
}>();
</script>

<template>
  <span :class="[css.itemStatus, css[`itemStatus_${status.tone}`]]">
    <component
      :is="status.icon"
      :class="css.itemStatus_icon"
      aria-hidden="true"
    />
    <span :class="css.itemStatus_text">{{ status.text }}</span>
  </span>
</template>

<style lang="scss" module="css">
.itemStatus {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
}

.itemStatus_text {
  display: inline-block;

  &::first-letter {
    text-transform: uppercase;
  }
}

.itemStatus_danger {
  color: $color-red;
}

.itemStatus_warning {
  color: $color-amber;
}

.itemStatus_success {
  color: $color-green;
}

.itemStatus_muted {
  color: $color-fg-2;
}

.itemStatus_dim {
  color: $color-fg-dim;
}

.itemStatus_icon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
