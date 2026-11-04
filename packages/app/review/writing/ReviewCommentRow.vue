<!-- A comment being written, in its place in the diff (`ReviewRowInset`): the box while it is typed or GitHub refused it, and from the moment it is sent the comment itself, as its author wrote it, saying "Sending…" or that it went into the draft (`Review / Comment · pending`), until the threads read again hold it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { ItemUser } from '@/store/ItemTypes.js';

import type { ReviewCommentRow } from '../buildReviewRows.js';
import ReviewCommentFrame from '../threads/ReviewCommentFrame.vue';
import ReviewPendingPill from '../threads/ReviewPendingPill.vue';
import ReviewRowInset from '../threads/ReviewRowInset.vue';
import ReviewCommentBox from './ReviewCommentBox.vue';
import * as l from './ReviewCommentRow.loc.js';
import type { ReviewCommentStatus, ReviewCommentWay } from './ReviewWriting.js';

defineProps<{
  row: ReviewCommentRow;
  status: ReviewCommentStatus;
  draftOpen: boolean;
  draftCount: number;
  draftFirst: boolean;
  focused: boolean;
  replyTo?: string | null;
  suggestion?: string | null;
  codeChanged?: boolean;
  /** Who it shows as written by once sent. */
  author: ItemUser | null;
}>();

const emit = defineEmits<{
  send: [way: ReviewCommentWay];
  extend: [];
  leave: [];
  focus: [];
  blur: [];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const t = useTranslate();
const sentAt = new Date().toISOString();
</script>

<template>
  <ReviewRowInset :inline="row.inline">
    <div
      v-if="status.kind === 'sending' || status.kind === 'sent'"
      :class="css.reviewCommentRow_sent"
    >
      <ReviewCommentFrame
        :author="author"
        :created-at="sentAt"
      >
        <template #note>
          <ReviewPendingPill v-if="status.way === 'joinDraft' || status.way === 'startDraft'" />
          <span
            v-else-if="status.kind === 'sending'"
            :class="css.reviewCommentRow_sending"
            >{{ t(l.sending) }}</span
          >
        </template>
        <p :class="css.reviewCommentRow_body">{{ status.body }}</p>
      </ReviewCommentFrame>
    </div>
    <ReviewCommentBox
      v-else
      v-model:text="text"
      :target="row.target"
      :draft-open="draftOpen"
      :draft-count="draftCount"
      :draft-first="draftFirst"
      :failure="status.kind === 'failed' ? status.failure : null"
      :focused="focused"
      :reply-to="replyTo"
      :suggestion="suggestion"
      :code-changed="codeChanged"
      @send="emit('send', $event)"
      @extend="emit('extend')"
      @leave="emit('leave')"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
  </ReviewRowInset>
</template>

<style lang="scss" module="css">
.reviewCommentRow_sent {
  padding: $spacing-12 $spacing-14;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.reviewCommentRow_body {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.reviewCommentRow_sending {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
