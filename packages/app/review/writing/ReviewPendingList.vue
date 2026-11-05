<!-- The comments of a draft review, one line each in a dialog: where each is and how it starts. -->
<script lang="ts" setup>
import type { PendingComment } from './getPendingComments.js';

defineProps<{
  comments: readonly PendingComment[];
}>();
</script>

<template>
  <p
    v-for="comment in comments"
    :key="comment.id"
    :class="css.reviewPendingList_comment"
  >
    <span :class="css.reviewPendingList_where">{{ comment.where }}</span>
    <span :class="css.reviewPendingList_excerpt">{{ comment.excerpt }}</span>
  </p>
</template>

<style lang="scss" module="css">
.reviewPendingList_comment {
  display: flex;
  gap: $spacing-8;
  margin: 0;
  font-size: $font-size-xs;
}

.reviewPendingList_where {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
}

.reviewPendingList_excerpt {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
