<!-- A comment being written, wherever it sits: in its place in the diff or a reply inside its thread (D39). The box while it is typed or GitHub refused it, and from the moment it is sent the comment itself (`ReviewSentComment`), until the threads read again hold it: framed on its own, one of the comments in a thread. -->
<script lang="ts" setup>
import type { ItemUser } from '@/store/ItemTypes.js';

import ReviewCommentBox from './ReviewCommentBox.vue';
import ReviewSentComment from './ReviewSentComment.vue';
import type { ReviewCommentStatus, ReviewCommentTarget, ReviewCommentWay } from './ReviewWriting.js';

defineProps<{
  target: ReviewCommentTarget;
  /** A reply inside its thread: once sent it is one of its comments, with no frame of its own. */
  inThread?: boolean;
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
  extend: [delta: 1 | -1];
  leave: [];
  discard: [];
  focus: [];
  blur: [];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });
</script>

<template>
  <ReviewSentComment
    v-if="(status.kind === 'sending' || status.kind === 'sent') && inThread"
    :status="status"
    :author="author"
  />
  <div
    v-else-if="status.kind === 'sending' || status.kind === 'sent'"
    :class="css.reviewWrittenComment_sent"
  >
    <ReviewSentComment
      :status="status"
      :author="author"
    />
  </div>
  <ReviewCommentBox
    v-else
    v-model:text="text"
    :target="target"
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
    @extend="emit('extend', $event)"
    @leave="emit('leave')"
    @discard="emit('discard')"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<style lang="scss" module="css">
.reviewWrittenComment_sent {
  padding: $spacing-12 $spacing-14;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}
</style>
