<!-- A menu opened by right-clicking an area, or long-pressing it (reka-ui's `ContextMenu`), at the pointer: ↑/↓ move through its entries, → opens a submenu, Enter picks, Escape closes. The app's keys stay out of it (`data-no-commands`): a letter jumps to an entry. Entries are `MenuItem`s, `MenuSub`s, `MenuLabel`s and `MenuSeparator`s, as in a `Menu`. On a phone (`PhoneLayout.active`, mobile D45) the same entries open as a menu at the bottom (`MenuSheet`), named by `label`: from the area's context-menu event (a long press where the browser gives one) or through `v-model:open`. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger, Slot } from 'reka-ui';
import { nextTick } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import MenuSheet from './MenuSheet.vue';

const props = defineProps<{
  /** Right-click shows the browser's own menu. */
  disabled?: boolean;
  /** On a phone, the name of the menu at the bottom; "Actions" when not given. */
  label?: string;
  /** On a phone, what it acts on, under the name (an item's reference). */
  context?: string;
}>();

const emit = defineEmits<{
  /** Closed, about to give the focus back; `preventDefault()` when an entry moved it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  /** The area: one element, which gets the menu's handlers. */
  default(): unknown;
  /** The entries. */
  content(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });
const phoneLayout = useService(PhoneLayout);

/**
 * On a phone, the area's context-menu event opens the sheet. Not through reka-ui's root, which keeps its open state to
 * itself and would never hear that the sheet closed. As reka-ui does, a tick later, so that what is inside the area may
 * take the event first.
 */
async function openFromEvent(event: MouseEvent) {
  await nextTick();
  if (props.disabled || event.defaultPrevented) {
    return;
  }

  event.preventDefault();
  open.value = true;
}
</script>

<template>
  <template v-if="phoneLayout.active">
    <Slot @contextmenu="openFromEvent">
      <slot />
    </Slot>
    <MenuSheet
      v-model:open="open"
      :title="label"
      :context="context"
      @close-auto-focus="emit('closeAutoFocus', $event)"
    >
      <slot name="content" />
    </MenuSheet>
  </template>
  <ContextMenuRoot
    v-else
    v-model:open="open"
  >
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
        @close-auto-focus="emit('closeAutoFocus', $event)"
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
  box-shadow: $shadow-popover;

  @include motion-popper;
}
</style>
