<!-- A comment or a reply from the moment it is sent, as its author wrote it, until the threads read again hold it: "Sending…" while on its way, or that it went into the draft (`Review / Comment · pending`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import CommentReply from '@/comments/CommentReply.vue';
import type { ItemUser } from '@/store/ItemTypes.js';

import ReviewPendingPill from '../threads/ReviewPendingPill.vue';
import type { ReviewSentStatus } from './ReviewWriting.js';
import * as l from './ReviewSentComment.loc.js';

defineProps<{
  status: ReviewSentStatus;
  /** Who it shows as written by: the viewer. */
  author: ItemUser | null;
}>();

const t = useTranslate();
const sentAt = new Date().toISOString();
</script>

<template>
  <CommentReply
    :author="author"
    :created-at="sentAt"
  >
    <template #note>
      <ReviewPendingPill v-if="status.way === 'joinDraft' || status.way === 'startDraft'" />
      <span
        v-else-if="status.kind === 'sending'"
        :class="css.reviewSentComment_sending"
        >{{ t(l.sending) }}</span
      >
    </template>
    <p :class="css.reviewSentComment_body">{{ status.body }}</p>
  </CommentReply>
</template>

<style lang="scss" module="css">
.reviewSentComment_body {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.reviewSentComment_sending {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
