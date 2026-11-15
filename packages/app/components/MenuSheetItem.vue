<!-- One entry of a phone's menu at the bottom (`MenuSheet`, mobile D45): a row a finger's height running to the sheet's edges. Tapping it — or Enter or Space — emits `select` and closes the sheet, unless the handler calls `preventDefault()` (a choice of several, a submenu's entry). A choice says whether it is chosen (`aria-checked`); an entry not available is announced so and does nothing. `MenuItem`, `MenuSub`, `MenuRadioItem` and the item menu's submenus draw their content in it on a phone. -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';

import { MenuSheetContext } from './MenuSheetContext.js';

const props = withDefaults(
  defineProps<{
    role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
    /** A choice's state; read only for `menuitemcheckbox` and `menuitemradio`. */
    checked?: boolean | 'mixed';
    disabled?: boolean;
  }>(),
  { role: 'menuitem', checked: false },
);

const emit = defineEmits<{
  /** Picked; `preventDefault()` on the event keeps the sheet open. */
  select: [event: Event];
}>();

defineSlots<{ default(): unknown }>();

const sheet = injectContext(MenuSheetContext);

function pick() {
  if (props.disabled) {
    return;
  }

  const event = new CustomEvent('menu.itemSelect', { cancelable: true });
  emit('select', event);
  if (!event.defaultPrevented) {
    sheet.close();
  }
}
</script>

<template>
  <button
    type="button"
    :class="css.menuSheetItem"
    :role="role"
    :aria-checked="role === 'menuitem' ? undefined : checked"
    :aria-disabled="disabled || undefined"
    @click="pick"
  >
    <slot />
  </button>
</template>

<style lang="scss" module="css">
.menuSheetItem {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  width: 100%;
  min-height: $touch-target-size;
  padding: $spacing-6 $spacing-20;
  font: inherit;
  font-size: $font-size-xl;
  color: $color-fg;
  text-align: start;
  cursor: pointer;
  background: none;
  border: none;
  outline: none;

  &:active,
  &:focus-visible {
    background: $color-bg-3;
  }

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: -2px;
  }

  &[aria-disabled='true'] {
    color: $color-fg-dim;
    cursor: default;
  }

  // The entry's icon at a phone's size, whichever entry draws it.
  > svg {
    flex: none;
    width: $phone-row-icon-size;
    height: $phone-row-icon-size;
  }
}
</style>
