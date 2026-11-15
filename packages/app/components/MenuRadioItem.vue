<!-- One choice of a `MenuRadioGroup` (`menuitemradio`): an optional icon, the text, a dim detail ("one column per label") and a check when it is the chosen one. In a phone's menu at the bottom (`MenuSheet`) the same, as its row. -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import type { LucideIcon } from 'lucide-vue-next';
import { Check } from 'lucide-vue-next';
import { DropdownMenuItemIndicator, DropdownMenuRadioItem } from 'reka-ui';

import { MenuRadioContext } from './MenuRadioGroup.vue';
import { MenuSheetContext } from './MenuSheetContext.js';
import MenuSheetItem from './MenuSheetItem.vue';

const props = defineProps<{
  value: string;
  icon?: LucideIcon;
  /** Dim text after the label. */
  detail?: string;
  disabled?: boolean;
}>();

defineSlots<{ default(): unknown }>();

const sheet = injectContext(MenuSheetContext, { optional: true });
const group = injectContext(MenuRadioContext, { optional: true });
</script>

<template>
  <MenuSheetItem
    v-if="sheet"
    role="menuitemradio"
    :checked="group?.value === value"
    :disabled="disabled"
    @select="group?.choose(props.value)"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.menuRadioItem_icon"
      aria-hidden="true"
    />
    <span :class="css.menuRadioItem_text">
      <slot />
      <span
        v-if="detail"
        :class="css.menuRadioItem_detail"
        >{{ detail }}</span
      >
    </span>
    <Check
      v-if="group?.value === value"
      :class="css.menuRadioItem_check"
      aria-hidden="true"
    />
  </MenuSheetItem>
  <DropdownMenuRadioItem
    v-else
    :class="css.menuRadioItem"
    :value="value"
    :disabled="disabled"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.menuRadioItem_icon"
      aria-hidden="true"
    />
    <span :class="css.menuRadioItem_text">
      <slot />
      <span
        v-if="detail"
        :class="css.menuRadioItem_detail"
        >{{ detail }}</span
      >
    </span>
    <DropdownMenuItemIndicator :class="css.menuRadioItem_check">
      <Check aria-hidden="true" />
    </DropdownMenuItemIndicator>
  </DropdownMenuRadioItem>
</template>

<style lang="scss" module="css">
.menuRadioItem {
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

.menuRadioItem_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.menuRadioItem_text {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: baseline;
}

.menuRadioItem_detail {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.menuRadioItem_check {
  display: inline-flex;
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-accent;

  svg {
    width: 14px;
    height: 14px;
  }
}
</style>
