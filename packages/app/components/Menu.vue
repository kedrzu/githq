<!-- A dropdown menu (reka-ui's `DropdownMenu`): opened from its trigger by click, Enter, Space or ↓; ↑/↓ move through the items, Enter picks one, Escape closes and focus goes back to the trigger. Items are `MenuItem`s, headings `MenuLabel`s. -->
<script lang="ts" setup>
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';

withDefaults(
  defineProps<{
    /** Along the trigger's edge; `start` when not given. */
    align?: 'center' | 'end' | 'start';
    /** Where it opens; `bottom` when not given. */
    side?: 'bottom' | 'left' | 'right' | 'top';
  }>(),
  { align: 'start', side: 'bottom' },
);

defineSlots<{
  /** The trigger: one button (`Button`, `IconButton`), which gets the menu's handlers and ARIA. */
  trigger(): unknown;
  /** The items. */
  default(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="css.menu"
        :align="align"
        :side="side"
        :side-offset="4"
        :collision-padding="8"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style lang="scss" module="css">
.menu {
  z-index: 20;
  min-width: 200px;
  padding: $spacing-4;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: 0 8px 24px rgb(0 0 0 / 40%);
}
</style>
