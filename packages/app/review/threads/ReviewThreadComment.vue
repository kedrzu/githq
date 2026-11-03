<!-- A comment of a review thread or of the conversation beside the diff (`Review / Comment`): its head, saying when it is still in the reader's draft (`Review / Comment · pending`), and its body as GitHub rendered and sanitized it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import GitHubHtml from '@/item/GitHubHtml.vue';

import ReviewCommentFrame from './ReviewCommentFrame.vue';
import type { ReviewThreadComment } from './ReviewThread.js';
import * as l from './ReviewThreadComment.loc.js';

defineProps<{
  comment: Pick<ReviewThreadComment, 'author' | 'bodyHTML' | 'createdAt' | 'state' | 'url'>;
}>();

const t = useTranslate();
</script>

<template>
  <ReviewCommentFrame
    :author="comment.author"
    :url="comment.url"
    :created-at="comment.createdAt"
  >
    <template
      v-if="comment.state === 'PENDING'"
      #note
    >
      <span :class="css.reviewThreadComment_pending">{{ t(l.pending) }}</span>
    </template>
    <GitHubHtml :html="comment.bodyHTML" />
  </ReviewCommentFrame>
</template>

<style lang="scss" module="css">
.reviewThreadComment_pending {
  flex: none;
  padding: 1px $spacing-6;
  font-size: $font-size-3xs;
  font-weight: $font-weight-medium;
  color: $color-amber;
  background: rgba($color-amber, 0.12);
  border-radius: 4px;
}
</style>
