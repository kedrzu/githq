<!-- The toolbar at the foot of the diff while the viewer has a draft review on the pull request (D28, `Review / Pending toolbar`, CR35, CR36): how many comments wait, what that means, and the ways out, neither of them one click: Discard review… and Submit review… (⇧S) each open their dialog. A refused submission turns it red with GitHub's reason (`· failed`, CR76), everything kept: Edit review… goes back to the dialog, Try again sends the same again. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, PencilLine } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';

import * as l from './ReviewPendingToolbar.loc.js';
import type { ReviewFinishState } from './writing/ReviewWriting.js';

const props = defineProps<{
  commentCount: number;
  /** How finishing the draft is going. */
  finish: ReviewFinishState;
}>();

const emit = defineEmits<{
  /** Discard review… */
  discard: [];
  /** Submit review… or Edit review… */
  submit: [];
  retry: [];
}>();

const SUBMIT_KEY = 'Shift+S';
const t = useTranslate();

const failed = computed(() => (props.finish.kind === 'failed' ? props.finish : null));
const sending = computed(() => props.finish.kind === 'sending');
const failureText = computed(() => {
  const failure = failed.value?.failure;
  switch (failure?.kind) {
    case undefined:
      return null;
    case 'refused':
      return t(l.refused, { reason: failure.message });
    // No draft is no toolbar.
    case 'notReached':
    case 'noDraft':
    case 'draftFound':
      return t(l.notReached);
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
        :class="css.reviewPendingToolbar_quiet"
        size="sm"
        variant="ghost"
        @click="failed?.finish.kind === 'discard' ? emit('discard') : emit('submit')"
      >
        {{ t(l.edit) }}
      </Button>
      <Button
        :class="css.reviewPendingToolbar_main"
        size="sm"
        variant="light"
        @click="emit('retry')"
      >
        {{ t(l.tryAgain) }}
      </Button>
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
      <span :class="css.reviewPendingToolbar_note">{{ t(l.note) }}</span>
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
        :kbd="SUBMIT_KEY"
        :aria-keyshortcuts="SUBMIT_KEY"
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
  padding: 0 $spacing-8 0 14px;
  white-space: nowrap;
  background: rgba($color-amber, 0.1);
  border-top: 1px solid rgba($color-amber, 0.35);
}

.reviewPendingToolbar_failed {
  --review-pending-tone: #{$color-red};

  background: rgba($color-red, 0.1);
  border-top-color: rgba($color-red, 0.35);

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
