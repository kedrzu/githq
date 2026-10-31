<!-- A menu entry's key at its end: one chip ("O"), or one chip per key of a combination (`Shift+O` → ⇧ O); nothing without one. -->
<script lang="ts" setup>
import { computed } from 'vue';

import { formatCommandKey } from '@/commands/formatCommandKey.js';

import Kbd from './Kbd.vue';

const props = defineProps<{
  /** One chip as written ("Esc"). */
  kbd?: string;
  /** As `aria-keyshortcuts` writes it (`Shift+O`). */
  shortcut?: string;
}>();

const keys = computed(() => {
  if (props.shortcut) {
    return formatCommandKey(props.shortcut);
  }

  return props.kbd ? [props.kbd] : [];
});
</script>

<template>
  <span
    v-if="keys.length > 0"
    :class="css.menuShortcut"
  >
    <Kbd
      v-for="(key, index) in keys"
      :key="index"
      :keys="key"
    />
  </span>
</template>

<style lang="scss" module="css">
.menuShortcut {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
  margin-left: $spacing-8;
}
</style>
