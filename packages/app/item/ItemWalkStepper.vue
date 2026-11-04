<!-- The way through the list an item was opened from, in a toolbar: `K`, `J` and "2 / 4", then the toolbar's divider. Shown once the place is known. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';

import * as l from './ItemWalkStepper.loc.js';
import type { ItemWalkPosition } from './useItemWalk.js';

defineProps<{
  position: ItemWalkPosition;
  previousLabel: string;
  nextLabel: string;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
}>();

const t = useTranslate();
</script>

<template>
  <div :class="css.itemWalkStepper">
    <IconButton
      :label="previousLabel"
      kbd="K"
      aria-keyshortcuts="K"
      :disabled="position.index <= 1"
      @click="emit('previous')"
    >
      <Kbd keys="K" />
    </IconButton>
    <IconButton
      :label="nextLabel"
      kbd="J"
      aria-keyshortcuts="J"
      :disabled="position.index >= position.count"
      @click="emit('next')"
    >
      <Kbd keys="J" />
    </IconButton>
    <span :class="css.itemWalkStepper_position">{{
      t(l.position, { index: position.index, count: position.count })
    }}</span>
  </div>
  <span
    :class="css.itemWalkStepper_divider"
    aria-hidden="true"
  />
</template>

<style lang="scss" module="css">
.itemWalkStepper {
  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
}

.itemWalkStepper_position {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.itemWalkStepper_divider {
  flex: none;
  width: 1px;
  height: 16px;
  background: $color-border-2;
}
</style>
