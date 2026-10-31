<!-- An entry of a `Menu` or a context menu that opens a submenu beside it (reka-ui's `DropdownMenuSub`): by hovering it, by → or Enter; ← or Escape closes it again; inside it the app's keys stay out (`data-no-commands`). Its chevron sits right after the text, before the dim detail ("Set status › In progress"), so the key column at the end needs no room for it. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { ChevronRight } from 'lucide-vue-next';
import { DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from 'reka-ui';

import MenuShortcut from './MenuShortcut.vue';

defineProps<{
  icon?: LucideIcon;
  /** Dim text after the chevron: the current value. */
  detail?: string;
  /** Its key as `aria-keyshortcuts` writes it (`Shift+X`); the caller handles the key itself. */
  shortcut?: string;
  disabled?: boolean;
}>();

defineSlots<{
  /** The entry's text. */
  default(): unknown;
  /** The submenu's items. */
  content(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <DropdownMenuSub v-model:open="open">
    <DropdownMenuSubTrigger
      :class="css.menuSub"
      :disabled="disabled"
      :aria-keyshortcuts="shortcut"
    >
      <component
        :is="icon"
        v-if="icon"
        :class="css.menuSub_icon"
        aria-hidden="true"
      />
      <span :class="css.menuSub_text">
        <span :class="css.menuSub_label"><slot /></span>
        <ChevronRight
          :class="css.menuSub_chevron"
          aria-hidden="true"
        />
        <span
          v-if="detail"
          :class="css.menuSub_detail"
          >{{ detail }}</span
        >
      </span>
      <MenuShortcut :shortcut="shortcut" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :class="css.menuSub_content"
        :side-offset="6"
        :align-offset="-5"
        :collision-padding="8"
        data-no-commands
      >
        <slot name="content" />
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>

<style lang="scss" module="css">
.menuSub {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-8;
  cursor: pointer;
  border-radius: $radius-md;
  outline: none;

  &[data-highlighted],
  &[data-state='open'] {
    background: $color-bg-3;
  }

  &[data-disabled] {
    color: $color-fg-dim;
    cursor: default;
  }
}

.menuSub_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.menuSub_text {
  display: flex;
  flex: 1;
  gap: $spacing-4;
  align-items: center;
  min-width: 0;
}

.menuSub_label {
  flex: none;
}

.menuSub_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.menuSub_detail {
  min-width: 0;
  margin-left: $spacing-4;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.menuSub_content {
  z-index: 21;
  min-width: 200px;
  max-width: 320px;
  padding: $spacing-4;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  box-shadow: 0 8px 24px rgb(0 0 0 / 40%);
}
</style>
