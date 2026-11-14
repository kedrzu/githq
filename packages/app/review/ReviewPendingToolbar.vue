<!-- The toolbar at the foot of the diff while the viewer has a draft review on the pull request (D28, `Review / Pending toolbar`, CR35, CR36): how many comments wait, what that means, and the ways out, neither of them one click: Discard review… and Submit review… (⇧S) each open their dialog. A refused submission turns it red with GitHub's reason (`· failed`, CR76), everything kept: Edit review… goes back to the dialog, Try again sends the same again. A review with no draft shows here too, on its way and when refused, though no draft keeps the toolbar otherwise. A failure not about the draft open now can be dismissed, and a different draft than it was sent against takes Try again away: only the dialog, which lists its comments, can submit that one (D33). The bar runs the diff column's full width, its content kept to the diff's box by `--review-diff-inset`, how far in from each side the box stands (none outside a review). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, PencilLine } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';

import * as l from './ReviewPendingToolbar.loc.js';
import { REVIEW_KEYS } from './useReviewKeySheet.js';
import type { ReviewFinishState } from './writing/ReviewWriting.js';

const props = defineProps<{
  commentCount: number;
  /** A draft is open, even one with no comments yet, which the count can't say. */
  hasDraft: boolean;
  /** How finishing the draft is going. */
  finish: ReviewFinishState;
  canRetry: boolean;
  canDismiss: boolean;
}>();

const emit = defineEmits<{
  /** Discard review… */
  discard: [];
  /** Submit review… or Edit review… */
  submit: [];
  retry: [];
  dismiss: [];
}>();

const t = useTranslate();

const failed = computed(() => (props.finish.kind === 'failed' ? props.finish : null));
const sending = computed(() => props.finish.kind === 'sending');
const failureText = computed(() => {
  const failure = failed.value?.failure;
  switch (failure?.kind) {
    case undefined:
      return null;
    case 'refused':
      return failure.message === null ? t(l.refusedNoReason) : t(l.refused, { reason: failure.message });
    case 'notReached':
      return t(l.notReached);
    case 'commentRefused':
      return t(l.commentRefused);
    default:
      return assertNever(failure);
  }
});
</script>

<template>
  <section
    :class="[css.reviewPendingToolbar, failed && css.reviewPendingToolbar_failed]"
    :aria-label="t(l.label)"
  >
    <template v-if="failed">
      <CircleAlert
        :class="css.reviewPendingToolbar_icon"
        aria-hidden="true"
      />
      <span
        :class="css.reviewPendingToolbar_title"
        role="alert"
      >
        {{ failed.finish.kind === 'discard' ? t(l.discardFailed) : t(l.sendFailed) }}
      </span>
      <span
        :class="css.reviewPendingToolbar_note"
        :title="failureText ?? undefined"
        >{{ failureText }}</span
      >
      <Button
        v-if="canDismiss"
        :class="css.reviewPendingToolbar_quiet"
        size="sm"
        variant="ghost"
        @click="emit('dismiss')"
      >
        {{ t(l.dismiss) }}
      </Button>
      <Button
        :class="css.reviewPendingToolbar_quiet"
        size="sm"
        variant="ghost"
        @click="failed?.finish.kind === 'discard' ? emit('discard') : emit('submit')"
      >
        {{ t(l.edit) }}
      </Button>
      <Button
        v-if="canRetry"
        :class="css.reviewPendingToolbar_main"
        size="sm"
        variant="light"
        @click="emit('retry')"
      >
        {{ t(l.tryAgain) }}
      </Button>
    </template>
    <template v-else-if="sending && !hasDraft">
      <PencilLine
        :class="css.reviewPendingToolbar_icon"
        aria-hidden="true"
      />
      <span
        :class="css.reviewPendingToolbar_title"
        role="status"
      >
        {{ t(l.sending) }}
      </span>
    </template>
    <template v-else>
      <PencilLine
        :class="css.reviewPendingToolbar_icon"
        aria-hidden="true"
      />
      <span :class="css.reviewPendingToolbar_title">
        <strong :class="css.reviewPendingToolbar_count">{{ commentCount }}</strong>
        {{ t(l.pendingComments, { count: commentCount }) }}
      </span>
      <span :class="css.reviewPendingToolbar_note">{{ t(l.note, { count: commentCount }) }}</span>
      <Button
        :class="css.reviewPendingToolbar_quiet"
        size="sm"
        variant="ghost"
        :disabled="sending"
        @click="emit('discard')"
      >
        {{ t(l.discard) }}
      </Button>
      <Button
        :class="css.reviewPendingToolbar_main"
        size="sm"
        variant="light"
        :kbd="REVIEW_KEYS.submit"
        :keyshortcuts="REVIEW_KEYS.submit"
        :busy="sending"
        @click="emit('submit')"
      >
        {{ t(l.submit) }}
      </Button>
    </template>
  </section>
</template>

<style lang="scss" module="css">
.reviewPendingToolbar {
  --review-pending-tone: #{$color-amber};

  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 44px;
  padding: 0 calc(var(--review-diff-inset, 0px) + #{$spacing-8}) 0 calc(var(--review-diff-inset, 0px) + #{$spacing-14});
  white-space: nowrap;
  background: rgba($color-amber, 0.1);
  border-top: 1px solid rgba($color-amber, 0.35);
}

.reviewPendingToolbar_failed {
  --review-pending-tone: #{$color-red};

  background: $color-bg-danger;
  border-top-color: $color-border-danger;

  .reviewPendingToolbar_title {
    color: $color-red;
  }
}

.reviewPendingToolbar_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--review-pending-tone);
}

.reviewPendingToolbar_title {
  flex: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.reviewPendingToolbar_count {
  font-size: $font-size-md;
  font-weight: 700;
  color: $color-amber;
}

.reviewPendingToolbar_note {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
}

.reviewPendingToolbar .reviewPendingToolbar_quiet {
  flex: none;
  color: $color-fg-2;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewPendingToolbar .reviewPendingToolbar_main {
  flex: none;
  color: $color-on-light;
  background: var(--review-pending-tone);
  border-color: var(--review-pending-tone);
}
</style>
