<!-- A dropdown menu (reka-ui's `DropdownMenu`): opened from its trigger by click, Enter, Space or ↓; ↑/↓ move through the items, Enter picks one, Escape closes and focus goes back to the trigger. Items are `MenuItem`s, headings `MenuLabel`s. On a phone (`PhoneLayout.active`, mobile D45) the same items open as a menu at the bottom (`MenuSheet`), named by `label`. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';

import { PhoneLayout } from '@/shell/PhoneLayout.js';

import MenuSheet from './MenuSheet.vue';

withDefaults(
  defineProps<{
    /** Along the trigger's edge; `start` when not given. */
    align?: 'center' | 'end' | 'start';
    /** Where it opens; `bottom` when not given. */
    side?: 'bottom' | 'left' | 'right' | 'top';
    /**
     * Whether the rest of the page is hidden from assistive technology and the pointer while it is open; `true` when
     * not given. A menu folded out of a toolbar beside a text being written is not: the text stays as it was.
     */
    modal?: boolean;
    /** On a phone, the name of the menu at the bottom ("Item actions"); "Actions" when not given. */
    label?: string;
    /** On a phone, what it acts on, under the name (an item's reference). */
    context?: string;
  }>(),
  { align: 'start', side: 'bottom', modal: true, label: undefined, context: undefined },
);

const emit = defineEmits<{
  /** Closed, about to give the focus back to the trigger; `preventDefault()` when an entry moved it elsewhere. */
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  /** The trigger: one button (`Button`, `IconButton`), which gets the menu's handlers and ARIA. */
  trigger(): unknown;
  /** The items. */
  default(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });
const phoneLayout = useService(PhoneLayout);
</script>

<template>
  <MenuSheet
    v-if="phoneLayout.active"
    v-model:open="open"
    :title="label"
    :context="context"
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <slot />
  </MenuSheet>
  <DropdownMenuRoot
    v-else
    v-model:open="open"
    :modal="modal"
  >
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
        @close-auto-focus="emit('closeAutoFocus', $event)"
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
  box-shadow: $shadow-popover;

  @include motion-popper;
}
</style>
