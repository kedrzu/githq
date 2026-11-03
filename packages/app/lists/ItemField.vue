<!-- One field of an item or a stack in a list or on a card: an icon, its value and "+N" for the rest (a project's row field, the milestone). The same in a row, a card and a stack's row; the parent gives it its place (`flex: none` or `min-width: 0`). -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

defineProps<{
  icon: LucideIcon;
  value: string | null;
  more?: string | null;
  title?: string;
}>();
</script>

<template>
  <span
    :class="css.itemField"
    :title="title"
  >
    <component
      :is="icon"
      :class="css.itemField_icon"
      aria-hidden="true"
    />
    {{ value }}
    <span
      v-if="more"
      :class="css.itemField_more"
      >{{ more }}</span
    >
  </span>
</template>

<style lang="scss" module="css">
.itemField {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  color: $color-fg-2;
}

.itemField_icon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.itemField_more {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}
</style>
