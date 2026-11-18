<!-- A menu entry's key at its end, in one chip even with a modifier (`Shift+O` → ⇧O); nothing without one, and nothing in a phone's menu at the bottom (`MenuSheet`, mobile D52) or where key hints are hidden (`KeyHintsContext`). -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import { computed } from 'vue';

import Kbd from './Kbd.vue';
import { KeyHintsContext } from './KeyHintsContext.js';
import { MenuSheetContext } from './MenuSheetContext.js';

const props = defineProps<{
  /** The key in the app's notation (`Escape`, `Shift+O`). */
  keys?: string;
}>();

const sheet = injectContext(MenuSheetContext, { optional: true });
const hints = injectContext(KeyHintsContext, { optional: true });

const shown = computed(() => (sheet || hints?.hidden ? undefined : props.keys));
</script>

<template>
  <Kbd
    v-if="shown"
    :class="css.menuShortcut"
    :keys="shown"
  />
</template>

<style lang="scss" module="css">
.menuShortcut {
  margin-left: $spacing-8;
}
</style>
