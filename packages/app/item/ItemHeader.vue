<!-- The header of an opened item, whatever its kind: what it is (the `identity` slot: an issue's reference and menu, a workflow's state and name) at the left; at the right the way through the list it was opened from (`ItemWalkStepper`, with the kind's step keys), the other arrangement (`⇧Enter`), GitHub (`O`) and close (`Esc`). It shows and reports; the keys themselves are `useItemKeys`'. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, X } from 'lucide-vue-next';

import IconButton from '@/components/IconButton.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

import type { ItemArrangement } from './itemRoutes.js';
import * as l from './useItemArrangement.loc.js';
import ItemWalkStepper from './ItemWalkStepper.vue';
import { ITEM_ARRANGEMENT_KEYS } from './useItemArrangement.js';
import type { ItemStepKeys, OtherArrangement } from './useItemArrangement.js';
import type { ItemWalkPosition } from './useItemWalk.js';

defineProps<{
  /** The item's place in the list it was opened from; `null` hides the stepper until it is known. */
  position: ItemWalkPosition | null;
  /** `null` where there is no other arrangement to offer. */
  otherArrangement: OtherArrangement | null;
  /** The item on GitHub. */
  url: string;
  stepKeys: ItemStepKeys;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
  arrange: [arrangement: ItemArrangement];
  close: [];
}>();

defineSlots<{
  /** What the item is, at the header's left. */
  identity(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <header
    :class="css.itemHeader"
    v-bind="WINDOW_DRAG_REGION"
  >
    <slot name="identity" />
    <span :class="css.itemHeader_spacer" />
    <ItemWalkStepper
      v-if="position"
      :position="position"
      :previous-label="t(l.previous)"
      :next-label="t(l.next)"
      :step-keys="stepKeys"
      @previous="emit('previous')"
      @next="emit('next')"
    />
    <IconButton
      v-if="otherArrangement"
      :icon="otherArrangement.icon"
      :label="otherArrangement.title"
      :kbd="ITEM_ARRANGEMENT_KEYS.arrange"
      :keyshortcuts="ITEM_ARRANGEMENT_KEYS.arrange"
      @click="emit('arrange', otherArrangement.arrangement)"
    />
    <IconButton
      :icon="Github"
      :label="t(l.openOnGitHub)"
      :kbd="ITEM_ARRANGEMENT_KEYS.openOnGitHub"
      :link="url"
      target="_blank"
      rel="noopener noreferrer"
      :keyshortcuts="ITEM_ARRANGEMENT_KEYS.openOnGitHub"
    />
    <IconButton
      :icon="X"
      :label="t(l.close)"
      :kbd="ITEM_ARRANGEMENT_KEYS.close"
      :keyshortcuts="ITEM_ARRANGEMENT_KEYS.close"
      @click="emit('close')"
    />
  </header>
</template>

<style lang="scss" module="css">
.itemHeader {
  @include list-header;

  padding: 0 14px 0 $spacing-16;
  font-size: $font-size-sm;
}

.itemHeader_spacer {
  flex: 1;
}
</style>
