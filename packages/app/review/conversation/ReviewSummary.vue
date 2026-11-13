<!-- A review in the pull request's conversation (`Activity / Review`, as cards CR120): the same card as on the pull request's thread (`CommentCard`) — who, the verdict (`CommentVerdict`), how long ago, its ⋯ with Quote reply and Copy link — its text as GitHub rendered and sanitized it, and under it what it started in the files, at either width, a click landing on the first of them (`Activity / Threads link`). Threads that show nowhere, resolved on a file gone from the diff, are said without the click. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowDownRight, MessageSquare } from 'lucide-vue-next';
import { computed } from 'vue';

import CommentCard from '@/comments/CommentCard.vue';
import CommentMenu from '@/comments/CommentMenu.vue';
import CommentVerdict from '@/comments/CommentVerdict.vue';
import type { CommentActions } from '@/comments/useCommentActions.js';
import GitHubHtml from '@/item/GitHubHtml.vue';
import type { ItemReviewSummary } from '@/store/ItemDetailTypes.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';
import * as l from './ReviewSummary.loc.js';

const props = defineProps<{
  review: ItemReviewSummary;
  threads: ReviewOwnThreads | null;
  /** Epoch ms the age is counted to. */
  now: number;
  /** What the conversation does with its cards: Quote reply and Copy link. */
  actions: CommentActions;
  /** The composer takes a comment: Quote reply is offered. */
  canQuote?: boolean;
}>();

const emit = defineEmits<{
  jumpToThreads: [];
}>();

const t = useTranslate();
const threadsLabel = computed(() => {
  const { threads } = props;
  return threads && t(threads.resolved ? l.threadsInFilesResolved : l.threadsInFiles, { count: threads.ids.size });
});
</script>

<template>
  <CommentCard
    :author="review.author"
    :created-at="review.submittedAt"
    :now="now"
    @menu-close="actions.onMenuClose"
  >
    <template #verdict>
      <CommentVerdict :state="review.state" />
    </template>
    <template
      v-if="review.bodyHtml !== '' || threads"
      #default
    >
      <GitHubHtml
        v-if="review.bodyHtml !== ''"
        :class="css.reviewSummary_text"
        :html="review.bodyHtml"
      />
      <button
        v-if="threads && threads.paths.length > 0"
        type="button"
        :class="css.reviewSummary_threads"
        @click="emit('jumpToThreads')"
      >
        <MessageSquare
          :class="css.reviewSummary_threadsIcon"
          aria-hidden="true"
        />
        {{ threadsLabel }}
        <ArrowDownRight
          :class="css.reviewSummary_threadsIcon"
          aria-hidden="true"
        />
      </button>
      <span
        v-else-if="threads"
        :class="css.reviewSummary_threadsNowhere"
      >
        <MessageSquare
          :class="css.reviewSummary_threadsIcon"
          aria-hidden="true"
        />
        {{ threadsLabel }}
      </span>
    </template>
    <template #menu>
      <CommentMenu
        :can-edit="false"
        :can-quote="(canQuote ?? false) && review.body !== ''"
        @quote-reply="actions.quote(review.body)"
        @copy-link="actions.copyLink(review.url)"
      />
    </template>
  </CommentCard>
</template>

<style lang="scss" module="css">
// GitHub's rendering, at the thread's reading size, as every card's.
.reviewSummary_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}

.reviewSummary_threads,
.reviewSummary_threadsNowhere {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  align-self: flex-start;
  padding: 0;
  font-size: $font-size-xs;
}

.reviewSummary_threads {
  @include focus-ring;

  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;

  &:hover {
    color: $color-fg;
  }
}

.reviewSummary_threadsNowhere {
  color: $color-fg-dim;
}

.reviewSummary_threadsIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}
</style>
