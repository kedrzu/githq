<!-- Actions as the entries of an item menu — the context menu of a list's rows (L1–L4) or the opened item's menu (M1–M2): one group after another with a line between them, each action with its icon, current value and key, so the menu teaches the keyboard. An action with a second step opens it beside the menu (`CommandSubmenu`); the others run when picked. -->
<script lang="ts" setup>
import MenuItem from '@/components/MenuItem.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';

import type { Command } from './CommandTypes.js';
import CommandSubmenu from './CommandSubmenu.vue';

defineProps<{
  /** The groups of actions, in order; an empty one is left out. */
  sections: readonly (readonly Command[])[];
  /** The action whose submenu is open as the menu opens (its key opened the menu there). */
  openId?: string | null;
}>();
</script>

<template>
  <template
    v-for="(section, index) in sections.filter(candidate => candidate.length > 0)"
    :key="index"
  >
    <MenuSeparator v-if="index > 0" />
    <template
      v-for="command in section"
      :key="command.id"
    >
      <CommandSubmenu
        v-if="command.options"
        :command="command"
        :start-open="command.id === openId"
      />
      <MenuItem
        v-else
        :icon="command.icon"
        :detail="command.detail"
        :shortcut="command.key"
        @select="command.run?.()"
      >
        {{ command.title }}
      </MenuItem>
    </template>
  </template>
</template>
