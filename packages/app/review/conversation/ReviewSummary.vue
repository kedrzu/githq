<!-- A review in the pull request's conversation (`Review / Summary`): who, the verdict, how long ago with a link to it on GitHub, its text as GitHub rendered and sanitized it, and what it started in the files, a click landing on the first of them. Threads that show nowhere, resolved on a file gone from the diff, are said without the click. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowDownRight, CircleCheck, CircleSlash, FileDiff, MessageSquare } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import GitHubHtml from '@/item/GitHubHtml.vue';
import { useNow } from '@/services/useNow.js';
import type { ItemReviewSummary } from '@/store/ItemDetailTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ReviewOwnThreads } from './getReviewOwnThreads.js';
import * as l from './ReviewSummary.loc.js';

const props = defineProps<{
  review: ItemReviewSummary;
  threads: ReviewOwnThreads | null;
}>();

const emit = defineEmits<{
  jumpToThreads: [];
}>();

/** How often "12m" moves on. */
const TICK_MS = 60_000;

const t = useTranslate();
const now = useNow(TICK_MS);
const age = computed(() => formatAge(Date.parse(props.review.submittedAt), now.value));
const verdict = computed(() => {
  const { state } = props.review;
  switch (state) {
    case 'APPROVED':
      return { icon: CircleCheck, tone: 'approved', label: t(l.APPROVED) };
    case 'CHANGES_REQUESTED':
      return { icon: FileDiff, tone: 'changes', label: t(l.CHANGES_REQUESTED) };
    case 'COMMENTED':
      return { icon: MessageSquare, tone: 'quiet', label: t(l.COMMENTED) };
    case 'DISMISSED':
      return { icon: CircleSlash, tone: 'quiet', label: t(l.DISMISSED) };
    default:
      return assertNever(state);
  }
});
const threadsLabel = computed(() => {
  const { threads } = props;
  return threads && t(threads.resolved ? l.threadsInFilesResolved : l.threadsInFiles, { count: threads.ids.size });
});
</script>

<template>
  <div :class="css.reviewSummary">
    <Avatar
      :name="review.author?.login ?? t(l.ghost)"
      :src="review.author?.avatarUrl"
      decorative
    />
    <div :class="css.reviewSummary_body">
      <p :class="css.reviewSummary_meta">
        <span :class="css.reviewSummary_author">{{ review.author?.login ?? t(l.ghost) }}</span>
        <span :class="[css.reviewSummary_verdict, css[`reviewSummary_verdict_${verdict.tone}`]]">
          <component
            :is="verdict.icon"
            :class="css.reviewSummary_icon"
            aria-hidden="true"
          />
          {{ verdict.label }}
        </span>
        <a
          :class="css.reviewSummary_age"
          :href="review.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t(l.openOnGitHub, { age })"
          :title="t(l.openOnGitHub, { age })"
          ><time :datetime="review.submittedAt">{{ age }}</time></a
        >
      </p>
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
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewSummary {
  display: flex;
  gap: $spacing-10;
}

.reviewSummary_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.reviewSummary_meta {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
}

.reviewSummary_author {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

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

.reviewSummary_age {
  @include focus-ring;

  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-decoration: none;
  border-radius: 3px;

  &:hover {
    color: $color-fg-2;
    text-decoration: underline;
  }
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
