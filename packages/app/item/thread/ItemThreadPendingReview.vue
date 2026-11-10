<!-- The viewer's own draft review on an item's thread (`Activity / Review · pending`, F14), last before the composer: an amber card, "Your review · pending" and when it was started, the threads it starts (`ItemThreadCodeThread`, their comments marked "Pending", no reply or resolve), and code review's own pending toolbar (`ReviewPendingToolbar`) at its foot: Discard review… and Submit review… (⇧S, also in the command menu) open code review's dialogs, and finish the draft through the same writing as code review (`ReviewWriting`), so a refusal shows here as it does there. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Send, Trash2 } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import ReviewPendingToolbar from '@/review/ReviewPendingToolbar.vue';
import { REVIEW_KEYS } from '@/review/useReviewKeySheet.js';
import type { PendingComment } from '@/review/writing/getPendingComments.js';
import ReviewDiscardDialog from '@/review/writing/ReviewDiscardDialog.vue';
import ReviewSubmitDialog from '@/review/writing/ReviewSubmitDialog.vue';
import { NO_REVIEW_SUBMISSION } from '@/review/writing/ReviewWriting.js';
import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import type { ThreadPendingReview } from './buildThread.js';
import ItemThreadCard from './ItemThreadCard.vue';
import ItemThreadCodeThread from './ItemThreadCodeThread.vue';
import * as l from './ItemThreadPendingReview.loc.js';

const props = defineProps<{
  entry: ThreadPendingReview;
  /** Epoch ms the age is counted to. */
  now: number;
  /** Who is signed in: the draft's author. */
  viewer: ItemUser | null;
  /** The pull request's number, as the dialogs name it. */
  number: number;
  /** Code review's writing of the pull request, which finishes the draft; none, no toolbar. */
  writing: ReviewWriting | null;
  /** The draft's comments, its replies on other threads among them, as the dialogs list them. */
  comments: readonly PendingComment[];
}>();

const t = useTranslate();
const submitOpen = ref(false);
const discardOpen = ref(false);

const finish = computed(() => props.writing?.finish ?? null);
const commentCount = computed(() => props.entry.review?.commentCount ?? props.comments.length);
const submission = computed({
  get: () => props.writing?.submission ?? NO_REVIEW_SUBMISSION,
  set: choice => props.writing?.setSubmission(choice),
});

useCommands(() => [
  {
    id: 'item.submitReview',
    title: t(l.submitReview),
    section: 'item',
    key: REVIEW_KEYS.submit,
    icon: Send,
    when: () => finish.value !== null && finish.value.kind !== 'sending',
    run: () => {
      submitOpen.value = true;
    },
  },
  {
    id: 'item.discardReview',
    title: t(l.discardReview),
    section: 'item',
    icon: Trash2,
    when: () => finish.value !== null && finish.value.kind !== 'sending' && props.entry.review !== null,
    run: () => {
      discardOpen.value = true;
    },
  },
]);

function submit() {
  submitOpen.value = false;
  props.writing?.submit(submission.value);
}

function discard() {
  discardOpen.value = false;
  props.writing?.discard();
}
</script>

<template>
  <ItemThreadCard
    :author="viewer"
    :created-at="entry.review?.createdAt"
    :now="now"
    :name="t(l.yourReview)"
    pending
  >
    <template #verdict>
      <span :class="css.itemThreadPendingReview_verdict">{{ t(l.pending) }}</span>
    </template>
    <template
      v-if="entry.threads.length > 0"
      #default
    >
      <div :class="css.itemThreadPendingReview_body">
        <ItemThreadCodeThread
          v-for="thread in entry.threads"
          :key="thread.id"
          :thread="thread"
          :viewer="viewer"
          draft
        />
      </div>
    </template>
    <template
      v-if="writing && finish"
      #footer
    >
      <ReviewPendingToolbar
        :comment-count="commentCount"
        :has-draft="entry.review !== null"
        :finish="finish"
        :can-retry="writing.canRetry"
        :can-dismiss="writing.canDismiss"
        @discard="discardOpen = true"
        @submit="submitOpen = true"
        @retry="writing.retry()"
        @dismiss="writing.dismiss()"
      />
      <ReviewSubmitDialog
        v-model:open="submitOpen"
        v-model:choice="submission"
        :number="number"
        :comment-count="writing.draftCount"
        :comments="comments"
        @submit="submit"
      />
      <ReviewDiscardDialog
        v-model:open="discardOpen"
        :number="number"
        :comment-count="commentCount"
        :comments="comments"
        @discard="discard"
      />
    </template>
  </ItemThreadCard>
</template>

<style lang="scss" module="css">
.itemThreadPendingReview_verdict {
  font-size: $font-size-xs;
  color: $color-amber;
}

.itemThreadPendingReview_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-14;
}
</style>
