<!-- A comment or a reply from the moment it is sent, as its author wrote it, until the threads read again hold it (`ReviewComment`): dimmed with "Sending…" while on its way, or saying that it went into the draft (`Review / Comment · pending`). No ⋯: GitHub has nothing to act on yet. -->
<script lang="ts" setup>
import type { ItemUser } from '@/store/ItemTypes.js';

import ReviewComment from '../threads/ReviewComment.vue';
import type { ReviewSentStatus } from './ReviewWriting.js';

defineProps<{
  status: ReviewSentStatus;
  /** Who it shows as written by: the viewer. */
  author: ItemUser | null;
}>();

const sentAt = new Date().toISOString();
</script>

<template>
  <ReviewComment
    :author="author"
    :created-at="sentAt"
    :in-draft="status.way === 'joinDraft' || status.way === 'startDraft'"
    :text="status.body"
    :sending="status.kind === 'sending'"
  />
</template>
