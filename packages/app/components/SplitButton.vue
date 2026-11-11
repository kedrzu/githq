<!-- A compact `Button` with a menu of the action's other ways joined to its end ("Close issue" ⇧X, then "Close as not planned" in the menu): the button does the usual one, the chevron after a rule is a click target of its own and opens the menu (`menu` slot, `MenuItem`s). Attributes go to the button. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { ChevronDown } from 'lucide-vue-next';

import Button from './Button.vue';
import IconButton from './IconButton.vue';
import Menu from './Menu.vue';

// The attributes are the button's, not the frame's.
defineOptions({ inheritAttrs: false });

defineProps<{
  icon?: LucideIcon;
  /** The button's key, drawn after its label; give it to `keyshortcuts` too. */
  kbd?: string;
  /** The keys that press the button, as `aria-keyshortcuts` writes them. */
  keyshortcuts?: string;
  /** The chevron's accessible name and tooltip ("More ways to close"). */
  menuLabel: string;
  /** The usual action; a promise keeps the button busy until it settles. */
  onClick?: (event: Event) => unknown;
}>();

defineSlots<{
  /** The button's label. */
  default(): unknown;
  /** The menu's items. */
  menu(): unknown;
}>();
</script>

<template>
  <div :class="css.splitButton">
    <Button
      v-bind="$attrs"
      :class="css.splitButton_main"
      size="compact"
      :icon="icon"
      :kbd="kbd"
      :keyshortcuts="keyshortcuts"
      @click="onClick"
    >
      <slot />
    </Button>
    <Menu align="end">
      <template #trigger>
        <IconButton
          :class="css.splitButton_menu"
          :icon="ChevronDown"
          :label="menuLabel"
        />
      </template>
      <slot name="menu" />
    </Menu>
  </div>
</template>

<style lang="scss" module="css">
.splitButton {
  display: inline-flex;
  flex: none;
}

// Its end joined to the chevron, which carries the frame on.
.splitButton_main {
  --button-padding-end: #{$spacing-6};
  --button-border-end-width: 0;
  --button-radius: #{$radius-md} 0 0 #{$radius-md};
}

// A segment of the frame the two parts draw together, as the button looks.
.splitButton_menu {
  --icon-button-glyph-size: 12px;
  --icon-button-width: auto;
  --icon-button-height: auto;
  --icon-button-padding: 0 #{$spacing-8} 0 #{$spacing-6};
  --icon-button-color: #{$color-fg-2};
  --icon-button-background: #{$color-bg-3};
  --icon-button-border: 1px solid #{$color-border-2};
  --icon-button-border-start: none;
  --icon-button-radius: 0 #{$radius-md} #{$radius-md} 0;
  --icon-button-hover-color: #{$color-fg};
  --icon-button-hover-background: #{$color-border};

  position: relative;

  // The rule before the chevron.
  &::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 1px;
    height: 14px;
    content: '';
    background: $color-border-2;
    transform: translateY(-50%);
  }
}
</style>
