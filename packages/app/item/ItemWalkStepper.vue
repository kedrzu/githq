<!-- The way through the list an item was opened from, in a toolbar: its step keys (`K`, `J`; `⇧K`, `⇧J` for a workflow) and "2 / 4", then the toolbar's divider. Shown once the place is known. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';

import * as l from './ItemWalkStepper.loc.js';
import type { ItemStepKeys } from './useItemArrangement.js';
import type { ItemWalkPosition } from './useItemWalk.js';

const props = withDefaults(
  defineProps<{
    position: ItemWalkPosition;
    previousLabel: string;
    nextLabel: string;
    /** In the app's key notation; left out, `K`/`J`. */
    stepKeys?: ItemStepKeys;
  }>(),
  { stepKeys: () => ({ previous: 'K', next: 'J' }) },
);

const emit = defineEmits<{
  previous: [];
  next: [];
}>();

const t = useTranslate();

/** A chord (`Shift+K`) draws two keycaps, wider than the square button. */
const wideKeys = computed(() => props.stepKeys.previous.length > 1 || props.stepKeys.next.length > 1);
</script>

<template>
  <div :class="[css.itemWalkStepper, wideKeys && css.itemWalkStepper_wideKeys]">
    <IconButton
      :label="previousLabel"
      :kbd="stepKeys.previous"
      :keyshortcuts="formatAriaKeyShortcuts(stepKeys.previous)"
      :disabled="position.index <= 1"
      @click="emit('previous')"
    >
      <Kbd :keys="stepKeys.previous" />
    </IconButton>
    <IconButton
      :label="nextLabel"
      :kbd="stepKeys.next"
      :keyshortcuts="formatAriaKeyShortcuts(stepKeys.next)"
      :disabled="position.index >= position.count"
      @click="emit('next')"
    >
      <Kbd :keys="stepKeys.next" />
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

.itemWalkStepper_wideKeys {
  --icon-button-width: auto;
  --icon-button-padding: 0 #{$spacing-2};
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
