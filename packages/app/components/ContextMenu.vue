<!-- A menu opened by right-clicking an area, or long-pressing it (reka-ui's `ContextMenu`), at the pointer: ↑/↓ move through its entries, → opens a submenu, Enter picks, Escape closes. The app's keys stay out of it (`data-no-commands`): a letter jumps to an entry. Entries are `MenuItem`s, `MenuSub`s, `MenuLabel`s and `MenuSeparator`s, as in a `Menu`. -->
<script lang="ts" setup>
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';

defineProps<{
  /** Right-click shows the browser's own menu. */
  disabled?: boolean;
}>();

defineSlots<{
  /** The area: one element, which gets the menu's handlers. */
  default(): unknown;
  /** The entries. */
  content(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <ContextMenuRoot v-model:open="open">
    <ContextMenuTrigger
      as-child
      :disabled="disabled"
    >
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :class="css.contextMenu"
        :collision-padding="8"
        data-no-commands
      >
        <slot name="content" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style lang="scss" module="css">
.contextMenu {
  z-index: 20;
  min-width: 240px;
  padding: $spacing-4;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: 0 8px 24px rgb(0 0 0 / 40%);
}
</style>
