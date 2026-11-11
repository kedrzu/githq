<!-- The pull request's own conversation beside the diff (D5, D24): comments on the pull request rather than on a line and review summaries in one time order under its description, which stays folded until asked for. It scrolls on its own, opening at the newest and following it while there, and nothing in the diff moves it. A summary's threads take the reader to the diff. Comments and reviews not read yet come on asking, what is being read staying where it is. At its foot a comment on the pull request itself, which goes out at once as it does on an opened item, draft review or not (D17), and which with a draft open says so where it is written. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { X } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import GitHubHtml from '@/item/GitHubHtml.vue';
import ItemComposer from '@/item/ItemComposer.vue';
import { useNow } from '@/services/useNow.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import ReviewThreadComment from '../threads/ReviewThreadComment.vue';
import { REVIEW_KEYS } from '../useReviewKeySheet.js';

import { buildConversation } from './buildConversation.js';
import type { ReviewOwnThreads } from './getReviewOwnThreads.js';
import * as l from './ReviewConversation.loc.js';
import ReviewSummary from './ReviewSummary.vue';

const props = defineProps<{
  /** The pull request's row, once known. */
  item: Item | null;
  /** `null` until read. */
  detail: PullRequestDetail | null;
  /** What each review started, by its id. */
  reviewThreads: ReadonlyMap<string, ReviewOwnThreads>;
  /** Reads the comments not read yet; resolves once all are in. */
  loadOlder: () => Promise<void>;
  /** Reads the reviews not read yet; resolves once all are in. */
  loadOlderReviews: () => Promise<void>;
  /** A draft review is open: what is written here doesn't join it. */
  draftOpen?: boolean;
  /** The user may not comment here. */
  commentDisabled?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  jumpToThreads: [reviewId: string];
  comment: [body: string];
}>();

/** What is typed in its composer. */
const commentDraft = defineModel<string>('commentDraft', { default: '' });

/** How often "12m" moves on. */
const TICK_MS = 60_000;
/** How far from the end still counts as at the newest: the browser rounds the position to its pixels. */
const AT_END = 2;

const t = useTranslate();
const now = useNow(TICK_MS);
const scroller = useTemplateRef<HTMLElement>('scroller');
const content = useTemplateRef<HTMLElement>('content');
const fold = useTemplateRef<HTMLElement>('fold');
const unfolded = shallowRef(false);
const folding = shallowRef(false);

const entries = computed(() =>
  props.detail
    ? buildConversation({
        comments: props.detail.comments.nodes,
        summaries: props.detail.reviewSummaries,
        threads: props.reviewThreads,
      })
    : [],
);
const olderCount = computed(() => {
  const comments = props.detail?.comments;
  return comments?.olderCursor ? comments.totalCount - comments.nodes.length : 0;
});
// Not counted: some of them say nothing, and those aren't entries.
const hasOlderReviews = computed(() => (props.detail?.olderReviewCursor ?? null) !== null);
const count = computed(() => entries.value.length + olderCount.value);
const description = computed(() => props.detail?.bodyHtml ?? '');
const openedAge = computed(() => (props.item ? formatAge(Date.parse(props.item.createdAt), now.value) : ''));

/** Until the reader scrolls away from it, or asks for something above it. */
let atNewest = true;
/** What the browser says the scroll position is since we last wrote or read it: anything else is the user's. */
let knownScrollTop = 0;
const growth = new ResizeObserver(() => {
  if (atNewest) {
    scrollToNewest();
  }

  const element = fold.value;
  folding.value = element !== null && element.scrollHeight > element.clientHeight;
});

// The fold and what it holds come and go with the detail; the text and late images change their height.
watch(
  [fold, content],
  ([foldElement, contentElement]) => {
    growth.disconnect();
    for (const element of [scroller.value, contentElement, foldElement?.firstElementChild]) {
      if (element) {
        growth.observe(element);
      }
    }
  },
  { flush: 'post' },
);

onMounted(scrollToNewest);
onBeforeUnmount(() => growth.disconnect());

function scrollToNewest() {
  const element = scroller.value;
  if (element) {
    element.scrollTop = element.scrollHeight;
    knownScrollTop = element.scrollTop;
  }
}

function onScroll() {
  // Our own write's event may arrive after the text grew, which would look like the user leaving the newest.
  const element = scroller.value;
  if (element && element.scrollTop !== knownScrollTop) {
    knownScrollTop = element.scrollTop;
    atNewest = element.scrollHeight - element.scrollTop - element.clientHeight <= AT_END;
  }
}

function showDescription() {
  atNewest = false;
  unfolded.value = true;
}

/** The newest again: the comment is what they just wrote. */
function onComment(body: string) {
  atNewest = true;
  emit('comment', body);
}

async function showOlder(load: () => Promise<void>) {
  atNewest = false;
  const before = scroller.value?.scrollHeight ?? 0;
  await load();
  await nextTick();
  const element = scroller.value;
  if (element) {
    element.scrollTop += element.scrollHeight - before;
    knownScrollTop = element.scrollTop;
  }
}
</script>

<template>
  <section
    :class="css.reviewConversation"
    :aria-label="t(l.title)"
  >
    <header :class="css.reviewConversation_head">
      <h2 :class="css.reviewConversation_title">{{ t(l.title) }}</h2>
      <span
        v-if="count > 0"
        :class="css.reviewConversation_count"
        >{{ count }}</span
      >
      <span :class="css.reviewConversation_spacer" />
      <Kbd :keys="REVIEW_KEYS.conversation" />
      <IconButton
        :icon="X"
        :label="t(l.close)"
        @click="emit('close')"
      />
    </header>
    <div
      ref="scroller"
      :class="css.reviewConversation_scroller"
      tabindex="0"
      @scroll.passive="onScroll"
    >
      <div
        ref="content"
        :class="css.reviewConversation_items"
      >
        <div
          v-if="item"
          :class="css.reviewConversation_description"
        >
          <p :class="css.reviewConversation_meta">
            <Avatar
              :name="item.author?.login ?? t(l.ghost)"
              :src="item.author?.avatarUrl"
              decorative
            />
            <span :class="css.reviewConversation_author">{{ item.author?.login ?? t(l.ghost) }}</span>
            <span :class="css.reviewConversation_what">{{ t(l.opened, { age: openedAge }) }}</span>
          </p>
          <div
            v-if="description !== ''"
            ref="fold"
            :class="[!unfolded && css.reviewConversation_fold]"
          >
            <GitHubHtml :html="description" />
          </div>
          <Button
            v-if="folding && !unfolded"
            variant="link"
            tone="accent"
            size="sm"
            @click="showDescription"
          >
            {{ t(l.showDescription) }}
          </Button>
        </div>
        <hr
          v-if="item && (count > 0 || hasOlderReviews)"
          :class="css.reviewConversation_rule"
        />
        <Button
          v-if="olderCount > 0"
          variant="link"
          size="sm"
          @click="showOlder(loadOlder)"
        >
          {{ t(l.showOlder, { count: olderCount }) }}
        </Button>
        <Button
          v-if="hasOlderReviews"
          variant="link"
          size="sm"
          @click="showOlder(loadOlderReviews)"
        >
          {{ t(l.showOlderReviews) }}
        </Button>
        <p
          v-if="!detail"
          :class="css.reviewConversation_note"
        >
          {{ t(l.reading) }}
        </p>
        <p
          v-else-if="count === 0 && !hasOlderReviews"
          :class="css.reviewConversation_note"
        >
          {{ t(l.empty) }}
        </p>
        <ol
          v-if="entries.length > 0"
          :class="css.reviewConversation_entries"
        >
          <li
            v-for="entry in entries"
            :key="entry.id"
          >
            <ReviewThreadComment
              v-if="entry.kind === 'comment'"
              :comment="entry.comment"
            />
            <ReviewSummary
              v-else
              :review="entry.review"
              :threads="entry.threads"
              @jump-to-threads="emit('jumpToThreads', entry.review.id)"
            />
          </li>
        </ol>
      </div>
    </div>
    <footer :class="css.reviewConversation_composer">
      <ItemComposer
        v-model:text="commentDraft"
        :disabled="commentDisabled"
        :placeholder="draftOpen ? t(l.composerWithDraft) : t(l.composer)"
        @submit="onComment"
      />
    </footer>
  </section>
</template>

<style lang="scss" module="css">
.reviewConversation {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: $color-bg;
}

.reviewConversation_composer {
  flex: none;
  padding: $spacing-10 $spacing-14;
  border-top: 1px solid $color-border;
}

.reviewConversation_head {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  height: 40px;
  padding: 0 $spacing-10 0 14px;
  border-bottom: 1px solid $color-border;
}

.reviewConversation_title {
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewConversation_count {
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
}

.reviewConversation_spacer {
  flex: 1;
}

.reviewConversation_scroller {
  @include focus-ring;

  flex: 1;
  min-height: 0;
  overflow-y: auto;
  // What is being read is held here, when older comments come in above it.
  overflow-anchor: none;

  &:focus-visible {
    outline-offset: -2px;
  }
}

.reviewConversation_items {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px;
}

.reviewConversation_description {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: flex-start;
}

.reviewConversation_meta {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
}

.reviewConversation_author {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewConversation_what {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// Five lines of `GitHubHtml`.
.reviewConversation_fold {
  max-height: 100px;
  overflow: hidden;
}

.reviewConversation_rule {
  width: 100%;
  height: 1px;
  margin: 0;
  background: $color-border;
  border: 0;
}

.reviewConversation_note {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.reviewConversation_entries {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
