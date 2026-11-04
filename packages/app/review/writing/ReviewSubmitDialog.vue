<!-- Submitting a review (D33, CR75): a dialog in the middle of the screen, so sending is never one click. A comment that goes on the pull request itself, then what the review is, a comment by default, on 1 2 3 once out of the field or by the arrows, the pending comments listed, and a button taking the choice's name and colour; ⌘↵ sends it from anywhere in here. With no comments pending a comment or a request for changes needs that text, as GitHub does, and the button says so. What is chosen stays with the caller, so that closing it or GitHub refusing loses none of it (CR76). -->
<script lang="ts" setup>
import type { PullRequestReviewEvent } from '@githq/github/generated.gen.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, FileDiff, MessageSquare } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Kbd from '@/components/Kbd.vue';
import RadioCards from '@/components/RadioCards.vue';
import TextArea from '@/components/TextArea.vue';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { PendingComment } from './getPendingComments.js';
import ReviewDialogFrame from './ReviewDialogFrame.vue';
import ReviewPendingList from './ReviewPendingList.vue';
import * as l from './ReviewSubmitDialog.loc.js';
import type { ReviewSubmissionChoice } from './ReviewWriting.js';

const props = defineProps<{
  number: number;
  commentCount: number;
  comments: readonly PendingComment[];
}>();

const emit = defineEmits<{
  submit: [];
}>();

const open = defineModel<boolean>('open', { default: false });
const choice = defineModel<ReviewSubmissionChoice>('choice', { required: true });

const SEND_KEY = 'Mod+Enter';
const t = useTranslate();

const options = computed((): readonly { value: PullRequestReviewEvent; label: string; icon: LucideIcon }[] => [
  { value: 'COMMENT', label: t(l.comment), icon: MessageSquare },
  { value: 'APPROVE', label: t(l.approve), icon: CircleCheck },
  { value: 'REQUEST_CHANGES', label: t(l.requestChanges), icon: FileDiff },
]);
/** Nothing to say and no comments pending: GitHub would refuse it, with no words of its own for a comment. */
const textNeeded = computed(() => props.commentCount === 0 && choice.value.event !== 'APPROVE');
const canSend = computed(() => !textNeeded.value || choice.value.body.trim() !== '');
const sendLabel = computed(() => {
  if (!canSend.value) {
    return choice.value.event === 'COMMENT' ? t(l.needsComment) : t(l.needsChanges);
  }

  return choice.value.event === 'COMMENT'
    ? t(l.submitReview)
    : (options.value.find(option => option.value === choice.value.event)?.label ?? t(l.submitReview));
});

function setBody(body: string) {
  choice.value = { ...choice.value, body };
}

function setEvent(event: PullRequestReviewEvent) {
  choice.value = { ...choice.value, event };
}

function send() {
  if (canSend.value) {
    emit('submit');
  }
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, SEND_KEY)) {
    event.preventDefault();
    send();
    return;
  }

  const option = isEditableTarget(event.target) ? undefined : options.value[Number(event.key) - 1];
  if (option) {
    event.preventDefault();
    setEvent(option.value);
  }
}
</script>

<template>
  <ReviewDialogFrame
    v-model:open="open"
    :title="t(l.title, { number: props.number })"
    :width="600"
    :body-class="css.reviewSubmitDialog_body"
    @keydown="onKeydown"
  >
    <div :class="css.reviewSubmitDialog_field">
      <p :class="css.reviewSubmitDialog_label">
        {{ t(l.commentLabel) }}
        <span
          v-if="!textNeeded"
          :class="css.reviewSubmitDialog_optional"
          >{{ t(l.optional) }}</span
        >
      </p>
      <TextArea
        :model-value="choice.body"
        :label="t(l.commentLabel)"
        label-hidden
        :placeholder="t(l.placeholder)"
        @update:model-value="setBody($event ?? '')"
      />
    </div>
    <RadioCards
      :class="css.reviewSubmitDialog_kinds"
      :model-value="choice.event"
      :options="options"
      :get-card-attrs="
        option => ({
          class: [css.reviewSubmitDialog_kind, css[`reviewSubmitDialog_kind_${option.value}`]],
        })
      "
      :aria-label="t(l.kind)"
      @update:model-value="setEvent"
    >
      <template #default="{ option }">
        <Kbd :keys="String(options.indexOf(option) + 1)" />
        <component
          :is="option.icon"
          :class="css.reviewSubmitDialog_kindIcon"
          aria-hidden="true"
        />
        {{ option.label }}
      </template>
    </RadioCards>
    <div
      v-if="commentCount > 0"
      :class="css.reviewSubmitDialog_comments"
    >
      <p :class="css.reviewSubmitDialog_commentsLabel">{{ t(l.pendingGo, { count: commentCount }) }}</p>
      <ReviewPendingList :comments="comments" />
    </div>
    <template #footer>
      <span :class="css.reviewSubmitDialog_note">{{ t(l.note) }}</span>
      <Button
        :class="css[`reviewSubmitDialog_send_${choice.event}`]"
        size="sm"
        variant="light"
        :disabled="!canSend"
        :kbd="SEND_KEY"
        :aria-keyshortcuts="formatAriaKeyShortcuts(SEND_KEY)"
        @click="send"
      >
        {{ sendLabel }}
      </Button>
    </template>
  </ReviewDialogFrame>
</template>

<style lang="scss" module="css">
.reviewSubmitDialog_body {
  gap: $spacing-14;
}

.reviewSubmitDialog_field {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.reviewSubmitDialog_label {
  margin: 0;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.reviewSubmitDialog_optional {
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.reviewSubmitDialog_kinds {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-8;
}

.reviewSubmitDialog_kind {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-12;
  font: inherit;
  font-size: $font-size-sm;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &[data-state='checked'] {
    font-weight: $font-weight-semibold;
    color: $color-fg;
    background: rgba($color-fg-2, 0.1);
    border-color: $color-border-2;
  }
}

.reviewSubmitDialog_kindIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.reviewSubmitDialog_kind_APPROVE .reviewSubmitDialog_kindIcon {
  color: $color-green;
}

.reviewSubmitDialog_kind_REQUEST_CHANGES .reviewSubmitDialog_kindIcon {
  color: $color-red;
}

.reviewSubmitDialog_kind_APPROVE[data-state='checked'] {
  background: rgba($color-green, 0.1);
  border-color: rgba($color-green, 0.5);
}

.reviewSubmitDialog_kind_REQUEST_CHANGES[data-state='checked'] {
  background: rgba($color-red, 0.1);
  border-color: rgba($color-red, 0.5);
}

.reviewSubmitDialog_comments {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.reviewSubmitDialog_commentsLabel {
  margin: 0;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.reviewSubmitDialog_note {
  margin-right: auto;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewSubmitDialog_send_APPROVE.reviewSubmitDialog_send_APPROVE {
  background: $color-green;
  border-color: $color-green;
}

.reviewSubmitDialog_send_REQUEST_CHANGES.reviewSubmitDialog_send_REQUEST_CHANGES {
  background: $color-red;
  border-color: $color-red;
}
</style>
