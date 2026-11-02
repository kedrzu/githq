<!-- One item of a `Menu` or a context menu: an optional icon, the text, a dim detail ("In progress", a branch name), a status at the end (`status` slot) and its key; `select` when clicked or picked with Enter, after which the menu closes. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { DropdownMenuItem } from 'reka-ui';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';

import MenuShortcut from './MenuShortcut.vue';

defineProps<{
  icon?: LucideIcon;
  /** The item's key, drawn at the end as one chip (`O`, `Escape`); the caller handles the key itself. */
  kbd?: string;
  /** The item's key in the app's notation (`Mod+K`, `Shift+O`), drawn one chip per key; the caller handles it. */
  shortcut?: string;
  /** Dim text after the label. */
  detail?: string;
  /** The detail is code (a reference, a branch name): set in the monospace font. */
  detailMono?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  /** Picked; `preventDefault()` on the event keeps the menu open. */
  select: [event: Event];
}>();

defineSlots<{
  default(): unknown;
  /** Said at the end, before the key: how the place it opens is ("Syncing stopped"). */
  status?(): unknown;
}>();
</script>

<template>
  <DropdownMenuItem
    :class="css.menuItem"
    :disabled="disabled"
    :aria-keyshortcuts="shortcut && formatAriaKeyShortcuts(shortcut)"
    @select="emit('select', $event)"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.menuItem_icon"
      aria-hidden="true"
    />
    <span :class="css.menuItem_text">
      <span :class="css.menuItem_label"><slot /></span>
      <span
        v-if="detail"
        :class="[css.menuItem_detail, detailMono && css.menuItem_detail_mono]"
        >{{ detail }}</span
      >
      <span
        v-if="$slots.status"
        :class="css.menuItem_status"
        ><slot name="status"
      /></span>
    </span>
    <MenuShortcut
      :kbd="kbd"
      :shortcut="shortcut"
    />
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
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: baseline;
  min-width: 0;
}

.menuItem_label {
  flex: none;
}

.menuItem_detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.menuItem_status {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin-left: auto;
  font-size: $font-size-xs;
  white-space: nowrap;
}

.menuItem_detail_mono {
  font-family: $font-family-mono;
}
</style>
