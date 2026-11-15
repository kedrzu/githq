<!-- One field of an item or a stack in a list or on a card: an icon, its value and "+N" for the rest (a project's row field, the milestone); given a colour, a dot in it in place of the icon (a project's row field on a phone: mobile D23). The same in a row, a card and a stack's row; the parent gives it its place (`flex: none` or `min-width: 0`). -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

defineProps<{
  icon: LucideIcon;
  value: string | null;
  more?: string | null;
  title?: string;
  /** Hex without `#`: a dot in this colour stands for the icon. */
  color?: string | null;
}>();
</script>

<template>
  <span
    :class="css.itemField"
    :title="title"
  >
    <span
      v-if="color"
      :class="css.itemField_dot"
      :style="{ background: `#${color}` }"
      aria-hidden="true"
    />
    <component
      :is="icon"
      v-else
      :class="css.itemField_icon"
      aria-hidden="true"
    />
    <span
      v-if="value"
      :class="css.itemField_value"
      >{{ value }}</span
    >
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

.itemField_dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

// Gives way with an ellipsis where the parent lets the field shrink (`min-width: 0`).
.itemField_value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itemField_more {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}
</style>
