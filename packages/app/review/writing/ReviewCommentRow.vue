<!-- A comment being written, in its place in the diff (`ReviewRowInset`): the box while it is typed or GitHub refused it, and from the moment it is sent the comment itself (`ReviewSentComment`), until the threads read again hold it. -->
<script lang="ts" setup>
import type { ItemUser } from '@/store/ItemTypes.js';

import type { ReviewCommentRow } from '../buildReviewRows.js';
import ReviewRowInset from '../threads/ReviewRowInset.vue';
import ReviewCommentBox from './ReviewCommentBox.vue';
import ReviewSentComment from './ReviewSentComment.vue';
import type { ReviewCommentStatus, ReviewCommentWay } from './ReviewWriting.js';

defineProps<{
  row: ReviewCommentRow;
  /** `owner/name` of the pull request. */
  repository: string;
  /** The pull request's number. */
  itemNumber: number;
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
</script>

<template>
  <ReviewRowInset :inline="row.inline">
    <div
      v-if="status.kind === 'sending' || status.kind === 'sent'"
      :class="css.reviewCommentRow_sent"
    >
      <ReviewSentComment
        :status="status"
        :author="author"
      />
    </div>
    <ReviewCommentBox
      v-else
      v-model:text="text"
      :target="row.target"
      :repository="repository"
      :item-number="itemNumber"
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
</style>
