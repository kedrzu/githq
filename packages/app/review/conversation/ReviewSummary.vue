<!-- A review in the pull request's conversation (`Review / Summary`): who, the verdict, how long ago with a link to it on GitHub, its text as GitHub rendered and sanitized it, and what it started in the files, a click landing on the first of them. Threads that show nowhere, resolved on a file gone from the diff, are said without the click. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowDownRight, MessageSquare } from 'lucide-vue-next';
import { computed } from 'vue';

import CommentReply from '@/comments/CommentReply.vue';
import { getReviewVerdict } from '@/item/getReviewVerdict.js';
import GitHubHtml from '@/item/GitHubHtml.vue';
import type { ItemReviewSummary } from '@/store/ItemDetailTypes.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';
import * as l from './ReviewSummary.loc.js';

const props = defineProps<{
  review: ItemReviewSummary;
  threads: ReviewOwnThreads | null;
}>();

const emit = defineEmits<{
  jumpToThreads: [];
}>();

const t = useTranslate();
const verdict = computed(() => getReviewVerdict(props.review.state));
const threadsLabel = computed(() => {
  const { threads } = props;
  return threads && t(threads.resolved ? l.threadsInFilesResolved : l.threadsInFiles, { count: threads.ids.size });
});
</script>

<template>
  <CommentReply
    :author="review.author"
    :url="review.url"
    :created-at="review.submittedAt"
    spaced
  >
    <template #verdict>
      <span :class="[css.reviewSummary_verdict, css[`reviewSummary_verdict_${verdict.tone}`]]">
        <component
          :is="verdict.icon"
          :class="css.reviewSummary_icon"
          aria-hidden="true"
        />
        {{ t(verdict.label) }}
      </span>
    </template>
    <GitHubHtml
      v-if="review.bodyHtml !== ''"
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
  </CommentReply>
</template>

<style lang="scss" module="css">
.reviewSummary_verdict {
  display: inline-flex;
  flex: 1;
  gap: $spacing-4;
  align-items: center;
  font-size: $font-size-xs;
}

.reviewSummary_verdict_approved {
  color: $color-green;
}

.reviewSummary_verdict_changes {
  color: $color-red;
}

.reviewSummary_verdict_quiet {
  color: $color-fg-dim;
}

.reviewSummary_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.reviewSummary_threads,
.reviewSummary_threadsNowhere {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  align-self: flex-start;
  padding: $spacing-2 0 0;
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
