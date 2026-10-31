<!-- One item of a `Menu`: an optional icon, the text and its key; `select` when clicked or picked with Enter, after which the menu closes. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { DropdownMenuItem } from 'reka-ui';

import Kbd from './Kbd.vue';

defineProps<{
  icon?: LucideIcon;
  /** The item's key, drawn at the end; the caller handles the key itself. */
  kbd?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  /** Picked; `preventDefault()` on the event keeps the menu open. */
  select: [event: Event];
}>();

defineSlots<{ default(): unknown }>();
</script>

<template>
  <DropdownMenuItem
    :class="css.menuItem"
    :disabled="disabled"
    @select="emit('select', $event)"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.menuItem_icon"
      aria-hidden="true"
    />
    <span :class="css.menuItem_text"><slot /></span>
    <Kbd v-if="kbd">{{ kbd }}</Kbd>
  </DropdownMenuItem>
</template>

<style lang="scss" module="css">
.menuItem {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-8;
  cursor: pointer;
  border-radius: $radius-md;
  outline: none;

  &[data-highlighted] {
    background: $color-bg-3;
  }

  &[data-disabled] {
    color: $color-fg-dim;
    cursor: default;
  }
}

.menuItem_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.menuItem_text {
  flex: 1;
}
</style>
