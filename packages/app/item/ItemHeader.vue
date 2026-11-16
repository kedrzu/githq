<!-- The header of an opened item, whatever its kind: what it is (the `identity` slot: an issue's reference and menu, a workflow's state and name) at the left; at the right the way through the list it was opened from (`ItemWalkStepper`, with the kind's step keys), the other arrangement (`⇧Enter`), GitHub (`O`) and close (`Esc`). On a phone (mobile MB33, MB62) it is the phone's top bar (`PhoneTopBar`): back at the left, naming what it returns to (`backTitle`), previous and next at the right while the item is in a list, nothing else — the item's actions are the command menu's. It shows and reports; the keys themselves are `useItemKeys`'. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ChevronDown, ChevronUp, Github, X } from 'lucide-vue-next';

import { closeItem, fullScreen, openOnGitHub } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import IconButton from '@/components/IconButton.vue';
import PhoneBackButton from '@/shell/PhoneBackButton.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

import type { ItemArrangement } from './itemRoutes.js';
import * as l from './useItemArrangement.loc.js';
import ItemWalkStepper from './ItemWalkStepper.vue';
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
  /**
   * On a phone, what back returns to (mobile D20): the list's name ("Issues"), or with no list the repository's; left
   * out, back says only "Back".
   */
  backTitle?: string;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
  arrange: [arrangement: ItemArrangement];
  /** Escape and the close button; on a phone back in the top bar (mobile D20). */
  close: [];
}>();

defineSlots<{
  /** What the item is, at the header's left. */
  identity(): unknown;
}>();

const t = useTranslate();
const phone = useService(PhoneLayout);
</script>

<template>
  <PhoneTopBar v-if="phone.active">
    <template #start>
      <PhoneBackButton
        :place="backTitle"
        @click="emit('close')"
      />
    </template>
    <template
      v-if="position"
      #actions
    >
      <IconButton
        :icon="ChevronUp"
        :label="t(l.previous)"
        :disabled="position.index <= 1"
        @click="emit('previous')"
      />
      <IconButton
        :icon="ChevronDown"
        :label="t(l.next)"
        :disabled="position.index >= position.count"
        @click="emit('next')"
      />
    </template>
  </PhoneTopBar>
  <header
    v-else
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
      :kbd="keyOf(fullScreen)"
      :keyshortcuts="keyOf(fullScreen)"
      @click="emit('arrange', otherArrangement.arrangement)"
    />
    <IconButton
      :icon="Github"
      :label="t(openOnGitHub.title)"
      :kbd="keyOf(openOnGitHub)"
      :link="url"
      target="_blank"
      rel="noopener noreferrer"
      :keyshortcuts="keyOf(openOnGitHub)"
    />
    <IconButton
      :icon="X"
      :label="t(l.close)"
      :kbd="keyOf(closeItem)"
      :keyshortcuts="keyOf(closeItem)"
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
