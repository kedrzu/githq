<!-- The bar a stack's rows leave pinned at the top of the review's left column once it scrolls (D25, `Review / Stack strip`, CR48), taking no height of its own: the stack's name and its places (`StackPlaces`), each square a link to that pull request's review, replacing the address (D2), so one click per pull request stays. -->
<script lang="ts" setup>
import { Layers } from 'lucide-vue-next';

import { getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import StackPlaces from '@/lists/StackPlaces.vue';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

defineProps<{
  stack: StackDescription;
  /** The id of the pull request under review. */
  currentId: string;
}>();

function getPath(pullRequest: PullRequestItem) {
  return getReviewPath(getItemReference(pullRequest));
}
</script>

<template>
  <div :class="css.reviewStackStrip">
    <div :class="css.reviewStackStrip_bar">
      <Layers
        :class="css.reviewStackStrip_icon"
        aria-hidden="true"
      />
      <span :class="css.reviewStackStrip_name">{{ stack.name.title }}</span>
      <StackPlaces
        :pips="stack.pips"
        :current-id="currentId"
        :get-path="getPath"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
// No height: it pins at the top of the column and covers what goes by under it, so nothing below it ever moves.
.reviewStackStrip {
  position: sticky;
  top: 0;
  z-index: 2;
  flex: none;
  height: 0;
}

.reviewStackStrip_bar {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: $review-stack-strip-height;
  padding: 0 $spacing-10 0 14px;
  background: $color-bg;
  border-bottom: 1px solid $color-border;
}

.reviewStackStrip_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.reviewStackStrip_name {
  flex: 1 1 0;
  min-width: 48px;
  overflow: hidden;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
