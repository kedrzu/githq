<!-- A menu entry's key at its end: one chip (`O`), or one chip per key of a combination (`Shift+O` → ⇧ O); nothing without one. -->
<script lang="ts" setup>
import { computed } from 'vue';

import Kbd from './Kbd.vue';

const props = defineProps<{
  /** One chip (`Escape`). */
  kbd?: string;
  /** A key in the app's notation (`Shift+O`), one chip per key. */
  shortcut?: string;
}>();

const keys = computed(() => {
  if (props.shortcut) {
    return props.shortcut.split('+');
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
