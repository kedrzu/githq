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

// Doubled: over `Button`'s and `IconButton`'s own look, whichever stylesheet comes last.
.splitButton_main.splitButton_main {
  padding-inline-end: $spacing-6;
  border-right: none;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

// The rule before the chevron, inside the frame the two parts draw together.
.splitButton_menu.splitButton_menu {
  position: relative;
  width: auto;
  height: auto;
  padding: 0 $spacing-8 0 $spacing-6;
  color: $color-fg-2;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-left: none;
  border-radius: 0 $radius-md $radius-md 0;

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

  &:hover,
  &[aria-expanded='true'] {
    color: $color-fg;
    background: $color-border;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}
</style>
