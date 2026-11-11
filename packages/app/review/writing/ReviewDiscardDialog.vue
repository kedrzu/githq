<!-- Discarding a draft review asks first (D28, CR39): a dialog in the middle of the screen naming the comments that go and that they can't be brought back. Focus starts on Cancel, and only the red button or ⌘↵ deletes. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import DialogFrame from '@/components/DialogFrame.vue';

import type { PendingComment } from './getPendingComments.js';
import * as l from './ReviewDiscardDialog.loc.js';
import ReviewPendingList from './ReviewPendingList.vue';

const props = defineProps<{
  number: number;
  commentCount: number;
  comments: readonly PendingComment[];
}>();

const emit = defineEmits<{
  discard: [];
}>();

const open = defineModel<boolean>('open', { default: false });

const DISCARD_KEY = 'Mod+Enter';
const t = useTranslate();

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, DISCARD_KEY)) {
    event.preventDefault();
    emit('discard');
  }
}
</script>

<template>
  <DialogFrame
    v-model:open="open"
    :title="t(l.title, { number: props.number })"
    :width="500"
    :body-class="css.reviewDiscardDialog_body"
    initial-focus="[data-cancel]"
    @keydown="onKeydown"
  >
    <p :class="css.reviewDiscardDialog_detail">{{ t(l.detail, { count: commentCount }) }}</p>
    <ReviewPendingList :comments="comments" />
    <template #footer>
      <Button
        size="sm"
        kbd="Escape"
        keyshortcuts="Escape"
        data-cancel
        @click="open = false"
      >
        {{ t(l.cancel) }}
      </Button>
      <Button
        :class="css.reviewDiscardDialog_discard"
        size="sm"
        variant="light"
        :kbd="DISCARD_KEY"
        :keyshortcuts="formatAriaKeyShortcuts(DISCARD_KEY)"
        @click="emit('discard')"
      >
        {{ t(l.discard, { count: commentCount }) }}
      </Button>
    </template>
  </DialogFrame>
</template>

<style lang="scss" module="css">
.reviewDiscardDialog_body {
  gap: $spacing-10;
}

.reviewDiscardDialog_detail {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewDiscardDialog_discard.reviewDiscardDialog_discard {
  background: $color-red;
  border-color: $color-red;
}
</style>
