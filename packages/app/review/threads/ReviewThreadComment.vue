<!-- A comment of a review thread or of the conversation beside the diff (`Review / Comment`): its head, saying when it is still in the reader's draft (`Review / Comment · pending`), and its body as GitHub rendered and sanitized it. -->
<script lang="ts" setup>
import GitHubHtml from '@/item/GitHubHtml.vue';

import ReviewCommentFrame from './ReviewCommentFrame.vue';
import ReviewPendingPill from './ReviewPendingPill.vue';
import type { ReviewThreadComment } from './ReviewThread.js';

defineProps<{
  comment: Pick<ReviewThreadComment, 'author' | 'bodyHTML' | 'createdAt' | 'state' | 'url'>;
}>();
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
      <ReviewPendingPill />
    </template>
    <GitHubHtml :html="comment.bodyHTML" />
  </ReviewCommentFrame>
</template>
