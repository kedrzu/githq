<!-- The pull request's own conversation beside the diff (D5, D24): comments on the pull request rather than on a line and review summaries in one time order under its description, which stays folded until asked for — each the same card as on the pull request's thread (`CommentEntry`, `ReviewSummary`, CR120), narrow as its column is (`CommentCard`), with the same ⋯: Edit in place, Quote reply into the composer here, Copy link, Delete…, where GitHub says the user may (`useCommentActions`). It scrolls on its own, opening at the newest and following it while there, and nothing in the diff moves it. A summary's threads take the reader to the diff. Comments and reviews not read yet come on asking, what is being read staying where it is. At its foot a comment on the pull request itself, which goes out at once as it does on an opened item, draft review or not (D17), and which with a draft open says so where it is written; it shows at once, "Sending…", and one GitHub did not take stays with why, Discard and Retry (`CommentFailedCard`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { X } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';

import CommentDeleteDialog from '@/comments/CommentDeleteDialog.vue';
import CommentEntry from '@/comments/CommentEntry.vue';
import CommentFailedCard from '@/comments/CommentFailedCard.vue';
import { quoteIntoDraft } from '@/comments/quoteIntoDraft.js';
import { useCommentActions } from '@/comments/useCommentActions.js';
import Button from '@/components/Button.vue';
import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import GitHubHtml from '@/item/GitHubHtml.vue';
import ItemComposer from '@/item/ItemComposer.vue';
import { useNow } from '@/services/useNow.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';

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
  /** Who is signed in: their comments GitHub did not take are theirs. */
  viewer?: ItemUser | null;
  /** The user's comments GitHub did not take, in the order they were written. */
  failedComments?: readonly FailedComment[];
  /** The user's edits of the comments and the description GitHub did not take. */
  failedEdits?: readonly FailedTextEdit[];
  /** Whom `@` suggests first in an editor. */
  people?: readonly ItemUser[];
}>();

const emit = defineEmits<{
  close: [];
  jumpToThreads: [reviewId: string];
  comment: [body: string];
  /** A comment or the description edited, or a comment deleted. */
  edit: [request: EditRequest];
  /** An edit GitHub did not take was cancelled: of the comment, or (`null`) the description. */
  discardEdit: [commentId: string | null];
  /** Send the failed comment again. */
  retry: [id: number];
  /** Drop the failed comment. */
  discard: [id: number];
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
const composer = useTemplateRef('composer');
const unfolded = shallowRef(false);
const folding = shallowRef(false);

const actions = useCommentActions({
  subject: () => props.item?.id ?? '',
  failedEdits: () => props.failedEdits,
  onEdit: request => emit('edit', request),
  onDiscardEdit: commentId => emit('discardEdit', commentId),
  onQuote: quote,
});

const entries = computed(() =>
  props.detail
    ? buildConversation({
        comments: props.detail.comments.nodes,
        summaries: props.detail.reviewSummaries,
        threads: props.reviewThreads,
        failedComments: props.failedComments,
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

/** Quote reply: into the composer here, the cursor after it. */
function quote(body: string) {
  if (props.commentDisabled) {
    return;
  }

  commentDraft.value = quoteIntoDraft(body, commentDraft.value);
  composer.value?.focus();
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
        <CommentEntry
          v-if="item && detail"
          :id="null"
          :actions="actions"
          :author="item.author"
          :created-at="item.createdAt"
          :now="now"
          :html="detail.bodyHtml"
          :body="detail.body"
          :pending-body="detail.pendingBody"
          :url="item.url"
          :edited="detail.lastEditedAt !== null"
          :can-edit="detail.viewerCanUpdate"
          :can-quote="!commentDisabled"
          :repository="item.repository.nameWithOwner"
          :item-number="item.number"
          :people="people"
        >
          <template
            v-if="detail.bodyHtml !== ''"
            #body
          >
            <div
              ref="fold"
              :class="[!unfolded && css.reviewConversation_fold]"
            >
              <GitHubHtml
                :class="css.reviewConversation_text"
                :html="detail.bodyHtml"
              />
            </div>
            <Button
              v-if="folding && !unfolded"
              :class="css.reviewConversation_unfold"
              variant="link"
              tone="accent"
              size="sm"
              @click="showDescription"
            >
              {{ t(l.showDescription) }}
            </Button>
          </template>
        </CommentEntry>
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
            <CommentEntry
              v-if="entry.kind === 'comment' && item"
              :id="entry.comment.id"
              :actions="actions"
              :author="entry.comment.author"
              :created-at="entry.comment.createdAt"
              :now="now"
              :html="entry.comment.bodyHtml"
              :body="entry.comment.body"
              :pending-body="entry.comment.pendingBody"
              :url="entry.comment.url"
              :edited="entry.comment.lastEditedAt !== null"
              :can-edit="entry.comment.viewerCanUpdate"
              :can-delete="entry.comment.viewerCanDelete"
              :can-quote="!commentDisabled"
              :repository="item.repository.nameWithOwner"
              :item-number="item.number"
              :people="people"
            />
            <ReviewSummary
              v-else-if="entry.kind === 'summary'"
              :review="entry.review"
              :threads="entry.threads"
              :now="now"
              :actions="actions"
              :can-quote="!commentDisabled"
              @jump-to-threads="emit('jumpToThreads', entry.review.id)"
            />
            <CommentFailedCard
              v-else-if="entry.kind === 'failedComment'"
              :author="viewer ?? null"
              :now="now"
              :body="entry.failed.body"
              :reason="entry.failed.reason"
              :can-retry="!commentDisabled"
              @discard="emit('discard', entry.failed.id)"
              @retry="emit('retry', entry.failed.id)"
            />
          </li>
        </ol>
      </div>
    </div>
    <footer :class="css.reviewConversation_composer">
      <ItemComposer
        ref="composer"
        v-model:text="commentDraft"
        :disabled="commentDisabled"
        :placeholder="draftOpen ? t(l.composerWithDraft) : t(l.composer)"
        @submit="onComment"
      />
    </footer>
    <CommentDeleteDialog
      :open="actions.deletingId !== null"
      @update:open="actions.cancelDelete()"
      @delete="actions.confirmDelete()"
    />
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

// The cards 8 apart, as on the pull request's thread.
.reviewConversation_items {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-8 $spacing-14 $spacing-14;
}

// GitHub's rendering, at the reading size of every card.
.reviewConversation_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}

.reviewConversation_unfold {
  align-self: flex-start;
}

// Five lines of `GitHubHtml` at the reading size.
.reviewConversation_fold {
  max-height: calc(5 * #{$font-size-reading} * #{$line-height-reading});
  overflow: hidden;
}

.reviewConversation_note {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.reviewConversation_entries {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
