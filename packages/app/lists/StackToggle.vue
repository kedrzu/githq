<!-- The chevron that expands or collapses a stack, on its card and on its row in a list, in the line after its name. Toggling it opens nothing, and it takes no focus, so the list's keys stay. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';

import * as l from './StackToggle.loc.js';

defineProps<{
  expanded: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const t = useTranslate();
</script>

<template>
  <button
    type="button"
    tabindex="-1"
    :class="css.stackToggle"
    :aria-expanded="expanded"
    :aria-label="t(expanded ? l.collapse : l.expand)"
    @mousedown.prevent
    @click.stop="emit('toggle')"
  >
    <component
      :is="expanded ? ChevronDown : ChevronRight"
      aria-hidden="true"
    />
  </button>
</template>

<style lang="scss" module="css">
.stackToggle {
  display: flex;
  flex: none;
  align-items: center;
  align-self: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  color: $color-fg-3;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg-2;
  }

  svg {
    width: 11px;
    height: 11px;
  }
}
</style>
