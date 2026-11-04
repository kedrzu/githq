<!-- Discarding a draft review asks first (D28, CR39): a dialog in the middle of the screen naming the comments that go and that they can't be brought back. Focus starts on Cancel, and only the red button or ⌘↵ deletes. The keys are the dialog's while it is open. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useTemplateRef } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';

import type { PendingComment } from './getPendingComments.js';
import * as l from './ReviewDiscardDialog.loc.js';

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
const root = useTemplateRef<HTMLElement>('root');

function onOpenFocus(event: Event) {
  event.preventDefault();
  root.value?.querySelector<HTMLElement>('[data-cancel]')?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, DISCARD_KEY)) {
    event.preventDefault();
    emit('discard');
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="t(l.title, { number: props.number })"
    :width="500"
    bare
    fit-content
    centered
    @open-auto-focus="onOpenFocus"
  >
    <div
      ref="root"
      :class="css.reviewDiscardDialog"
      data-no-commands
      data-layer
      @keydown="onKeydown"
    >
      <header :class="css.reviewDiscardDialog_head">
        <span
          :class="css.reviewDiscardDialog_title"
          aria-hidden="true"
          >{{ t(l.title, { number: props.number }) }}</span
        >
        <Kbd keys="Escape" />
      </header>
      <div :class="css.reviewDiscardDialog_body">
        <p :class="css.reviewDiscardDialog_detail">{{ t(l.detail, { count: commentCount }) }}</p>
        <p
          v-for="comment in comments"
          :key="comment.id"
          :class="css.reviewDiscardDialog_comment"
        >
          <span :class="css.reviewDiscardDialog_where">{{ comment.where }}</span>
          <span :class="css.reviewDiscardDialog_excerpt">{{ comment.excerpt }}</span>
        </p>
      </div>
      <footer :class="css.reviewDiscardDialog_footer">
        <Button
          size="sm"
          kbd="Escape"
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
          @click="emit('discard')"
        >
          {{ t(l.discard, { count: commentCount }) }}
        </Button>
      </footer>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.reviewDiscardDialog {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.reviewDiscardDialog_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: 14px $spacing-16;
}

.reviewDiscardDialog_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.reviewDiscardDialog_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-10;
  min-height: 0;
  padding: $spacing-16;
  overflow-y: auto;
  border-top: 1px solid $color-border;
}

.reviewDiscardDialog_detail {
  margin: 0;
  font-size: 12.5px;
  color: $color-fg-2;
}

.reviewDiscardDialog_comment {
  display: flex;
  gap: $spacing-8;
  margin: 0;
  font-size: $font-size-xs;
}

.reviewDiscardDialog_where {
  flex: none;
  font-family: $font-family-mono;
  font-size: 11.5px;
  color: $color-fg-2;
}

.reviewDiscardDialog_excerpt {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewDiscardDialog_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: flex-end;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewDiscardDialog .reviewDiscardDialog_discard {
  background: $color-red;
  border-color: $color-red;
}
</style>
