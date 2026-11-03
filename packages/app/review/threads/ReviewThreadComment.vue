<!-- A comment of a review thread or of the conversation beside the diff (`Review / Comment`): its head, and its body as GitHub rendered and sanitized it. -->
<script lang="ts" setup>
import GitHubHtml from '@/item/GitHubHtml.vue';

import ReviewCommentFrame from './ReviewCommentFrame.vue';
import type { ReviewThreadComment } from './ReviewThread.js';

defineProps<{
  comment: Pick<ReviewThreadComment, 'author' | 'bodyHTML' | 'createdAt' | 'url'>;
}>();
</script>

<template>
  <ReviewCommentFrame
    :author="comment.author"
    :url="comment.url"
    :created-at="comment.createdAt"
  >
    <GitHubHtml :html="comment.bodyHTML" />
  </ReviewCommentFrame>
</template>
