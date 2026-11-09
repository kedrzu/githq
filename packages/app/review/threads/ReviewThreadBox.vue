<!-- A review thread's box (`Review / Thread`): its comments, under an amber "Outdated" head saying how it was placed (D30). Resolved it is one 32 px line whatever else, with who, the first line and how many comments, and that line opens it; opened, the comments follow. The accent edge says it is the thread N and ⇧N are at (D32). Under the comments, what the viewer may do: Reply…, or "Add to your draft…" in a thread holding a pending comment, which `R` also does on the focused one, gives way while its box is open under the thread, and Resolve, or Unresolve on one opened (CR74). A change of state GitHub didn't take says so here, in the state it went back to. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { ChevronDown, ChevronUp, CircleCheck, History } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';

import { getHtmlFirstLine } from '../utils/getHtmlFirstLine.js';
import * as l from './ReviewThreadBox.loc.js';
import ReviewThreadComment from './ReviewThreadComment.vue';
import type { ReviewThread } from './ReviewThread.js';
import { REVIEW_KEYS } from '../useReviewKeySheet.js';
import ReviewFailureNote from '../writing/ReviewFailureNote.vue';
import type { ReviewWriteFailure } from '../writing/ReviewWriting.js';

const props = defineProps<{
  thread: ReviewThread;
  /** How it was placed, when outdated; `null` for no head. */
  outdatedNote: string | null;
  /** A resolved thread shows whole. */
  open?: boolean;
  focused?: boolean;
  /** Its reply box is open under it. */
  replying?: boolean;
  /** Why resolving it or opening it again didn't go through. */
  resolveFailure?: ReviewWriteFailure | null;
}>();

const emit = defineEmits<{
  /** Its one line was clicked. */
  toggle: [];
  reply: [];
  setResolved: [resolved: boolean];
}>();

const t = useTranslate();

const first = computed(() => props.thread.comments[0] ?? null);
const who = computed(() => first.value?.author?.login ?? t(l.ghost));
const firstLine = computed(() => getHtmlFirstLine(first.value?.bodyHTML ?? ''));
/** A reply here joins the draft the thread already has a comment in (CR36, CR75, CR76). */
const inDraft = computed(() => props.thread.comments.some(comment => comment.state === 'PENDING'));
const failureText = computed(() => {
  const failure = props.resolveFailure;
  const reason = props.thread.isResolved ? l.unresolveFailed : l.resolveFailed;
  switch (failure?.kind) {
    case undefined:
      return null;
    case 'refused':
      return t(reason, { reason: failure.message ?? t(l.noReason) });
    case 'notReached':
      return t(reason, { reason: t(l.notReached) });
    default:
      return assertNever(failure);
  }
});
</script>

<template>
  <div
    role="group"
    :aria-label="t(l.threadBy, { who })"
    :aria-current="focused ? 'true' : undefined"
    :class="[
      css.reviewThreadBox,
      thread.isResolved && css.reviewThreadBox_resolved,
      focused && css.reviewThreadBox_focused,
    ]"
  >
    <button
      v-if="thread.isResolved"
      type="button"
      :class="css.reviewThreadBox_line"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <CircleCheck
        :class="css.reviewThreadBox_resolvedIcon"
        aria-hidden="true"
      />
      <span :class="css.reviewThreadBox_state">{{ t(l.resolved) }}</span>
      <Avatar
        :name="who"
        :src="first?.author?.avatarUrl"
        size="xs"
        decorative
      />
      <span :class="css.reviewThreadBox_who">{{ who }}</span>
      <span :class="css.reviewThreadBox_excerpt">{{ firstLine }}</span>
      <span :class="css.reviewThreadBox_count">{{ t(l.comments, { count: thread.comments.length }) }}</span>
      <component
        :is="open ? ChevronUp : ChevronDown"
        :class="css.reviewThreadBox_chevron"
        aria-hidden="true"
      />
    </button>
    <div
      v-if="!thread.isResolved || open"
      :class="css.reviewThreadBox_body"
    >
      <p
        v-if="outdatedNote !== null"
        :class="css.reviewThreadBox_head"
      >
        <History
          :class="css.reviewThreadBox_outdatedIcon"
          aria-hidden="true"
        />
        <span :class="css.reviewThreadBox_outdated">{{ t(l.outdated) }}</span>
        <span :class="css.reviewThreadBox_note">{{ outdatedNote }}</span>
      </p>
      <ReviewThreadComment
        v-for="comment in thread.comments"
        :key="comment.id"
        :comment="comment"
      />
      <div
        v-if="
          (thread.viewerCanReply && !replying) ||
          (thread.isResolved ? thread.viewerCanUnresolve : thread.viewerCanResolve)
        "
        :class="css.reviewThreadBox_actions"
      >
        <Button
          v-if="thread.viewerCanReply && !replying"
          :class="css.reviewThreadBox_reply"
          variant="field"
          size="sm"
          block
          :kbd="focused ? REVIEW_KEYS.reply : undefined"
          :keyshortcuts="focused ? REVIEW_KEYS.reply : undefined"
          @click="emit('reply')"
        >
          {{ inDraft ? t(l.addToDraft) : t(l.reply) }}
        </Button>
        <span
          v-else
          :class="css.reviewThreadBox_spacer"
        />
        <Button
          v-if="thread.isResolved ? thread.viewerCanUnresolve : thread.viewerCanResolve"
          size="sm"
          variant="outline"
          @click="emit('setResolved', !thread.isResolved)"
        >
          {{ thread.isResolved ? t(l.unresolve) : t(l.resolve) }}
        </Button>
      </div>
    </div>
    <ReviewFailureNote
      v-if="failureText !== null"
      :class="css.reviewThreadBox_failure"
      :text="failureText"
    />
  </div>
</template>

<style lang="scss" module="css">
.reviewThreadBox {
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.reviewThreadBox_resolved {
  border-color: $color-border;
}

.reviewThreadBox_focused {
  border-color: $color-accent;
}

.reviewThreadBox_line {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 $spacing-12;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: $radius-lg;
}

.reviewThreadBox_resolvedIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-green;
}

.reviewThreadBox_state,
.reviewThreadBox_who {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewThreadBox_who {
  font-weight: $font-weight-medium;
}

.reviewThreadBox_excerpt {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewThreadBox_count {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.reviewThreadBox_chevron {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.reviewThreadBox_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: $spacing-12 $spacing-14;
}

.reviewThreadBox_resolved .reviewThreadBox_body {
  border-top: 1px solid $color-border;
}

.reviewThreadBox_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewThreadBox_actions .reviewThreadBox_reply {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 $spacing-8 0 $spacing-10;
  font-size: $font-size-xs;
}

.reviewThreadBox_spacer {
  flex: 1;
}

.reviewThreadBox_failure {
  padding: 0 $spacing-14 $spacing-10;
}

.reviewThreadBox_head {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-6;
  align-items: center;
  margin: 0;
  font-size: $font-size-xs;
}

.reviewThreadBox_outdatedIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.reviewThreadBox_outdated {
  font-weight: $font-weight-medium;
  color: $color-amber;
}

.reviewThreadBox_note {
  color: $color-fg-dim;
}
</style>
