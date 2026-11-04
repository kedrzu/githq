<!-- Submitting a draft review (D33, CR75): a dialog in the middle of the screen, so sending is never one click. An optional comment that goes on the pull request itself, then what the review is, a comment by default, on 1 2 3 once out of the field, the pending comments listed, and a button taking the choice's name and colour; ⌘↵ sends it from anywhere in here. What is chosen stays with the caller, so that closing it or GitHub refusing loses none of it (CR76). The keys are the dialog's while it is open. -->
<script lang="ts" setup>
import type { PullRequestReviewEvent } from '@githq/github/generated.gen.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, FileDiff, MessageSquare } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import { computed } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';
import TextArea from '@/components/TextArea.vue';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { PendingComment } from './getPendingComments.js';
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

const options = computed((): readonly { event: PullRequestReviewEvent; label: string; icon: LucideIcon }[] => [
  { event: 'COMMENT', label: t(l.comment), icon: MessageSquare },
  { event: 'APPROVE', label: t(l.approve), icon: CircleCheck },
  { event: 'REQUEST_CHANGES', label: t(l.requestChanges), icon: FileDiff },
]);
const sendLabel = computed(() =>
  choice.value.event === 'COMMENT'
    ? t(l.submitReview)
    : (options.value.find(option => option.event === choice.value.event)?.label ?? t(l.submitReview)),
);

function setBody(body: string) {
  choice.value = { ...choice.value, body };
}

function choose(event: AcceptableValue | undefined) {
  const option = options.value.find(other => other.event === event);
  if (option) {
    choice.value = { ...choice.value, event: option.event };
  }
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, SEND_KEY)) {
    event.preventDefault();
    emit('submit');
    return;
  }

  const option = isEditableTarget(event.target) ? undefined : options.value[Number(event.key) - 1];
  if (option) {
    event.preventDefault();
    choose(option.event);
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="t(l.title, { number: props.number })"
    :width="600"
    bare
    fit-content
    centered
  >
    <div
      :class="css.reviewSubmitDialog"
      data-no-commands
      data-layer
      @keydown="onKeydown"
    >
      <header :class="css.reviewSubmitDialog_head">
        <span
          :class="css.reviewSubmitDialog_title"
          aria-hidden="true"
          >{{ t(l.title, { number: props.number }) }}</span
        >
        <Kbd keys="Escape" />
      </header>
      <div :class="css.reviewSubmitDialog_body">
        <div :class="css.reviewSubmitDialog_field">
          <p :class="css.reviewSubmitDialog_label">
            {{ t(l.commentLabel) }}
            <span :class="css.reviewSubmitDialog_optional">{{ t(l.optional) }}</span>
          </p>
          <TextArea
            :model-value="choice.body"
            :label="t(l.commentLabel)"
            label-hidden
            :placeholder="t(l.placeholder)"
            @update:model-value="setBody($event ?? '')"
          />
        </div>
        <RadioGroupRoot
          :class="css.reviewSubmitDialog_kinds"
          :model-value="choice.event"
          :aria-label="t(l.kind)"
          @update:model-value="choose"
        >
          <RadioGroupItem
            v-for="(option, index) in options"
            :key="option.event"
            :class="[
              css.reviewSubmitDialog_kind,
              css[`reviewSubmitDialog_kind_${option.event}`],
              choice.event === option.event && css.reviewSubmitDialog_kind_chosen,
            ]"
            :value="option.event"
          >
            <Kbd :keys="String(index + 1)" />
            <component
              :is="option.icon"
              :class="css.reviewSubmitDialog_kindIcon"
              aria-hidden="true"
            />
            {{ option.label }}
          </RadioGroupItem>
        </RadioGroupRoot>
        <div
          v-if="commentCount > 0"
          :class="css.reviewSubmitDialog_comments"
        >
          <p :class="css.reviewSubmitDialog_commentsLabel">{{ t(l.pendingGo, { count: commentCount }) }}</p>
          <p
            v-for="comment in comments"
            :key="comment.id"
            :class="css.reviewSubmitDialog_comment"
          >
            <span :class="css.reviewSubmitDialog_where">{{ comment.where }}</span>
            <span :class="css.reviewSubmitDialog_excerpt">{{ comment.excerpt }}</span>
          </p>
        </div>
      </div>
      <footer :class="css.reviewSubmitDialog_footer">
        <span :class="css.reviewSubmitDialog_note">{{ t(l.note) }}</span>
        <Button
          :class="css[`reviewSubmitDialog_send_${choice.event}`]"
          size="sm"
          variant="light"
          :kbd="SEND_KEY"
          @click="emit('submit')"
        >
          {{ sendLabel }}
        </Button>
      </footer>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.reviewSubmitDialog {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.reviewSubmitDialog_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: 14px $spacing-16;
}

.reviewSubmitDialog_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.reviewSubmitDialog_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: $spacing-16;
  overflow-y: auto;
  border-top: 1px solid $color-border;
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
  font-weight: normal;
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
  font-size: 12.5px;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
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

.reviewSubmitDialog_kind_chosen {
  font-weight: $font-weight-semibold;
  color: $color-fg;
  background: rgba($color-fg-2, 0.1);
  border-color: $color-border-2;
}

.reviewSubmitDialog_kind_chosen.reviewSubmitDialog_kind_APPROVE {
  background: rgba($color-green, 0.1);
  border-color: rgba($color-green, 0.5);
}

.reviewSubmitDialog_kind_chosen.reviewSubmitDialog_kind_REQUEST_CHANGES {
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

.reviewSubmitDialog_comment {
  display: flex;
  gap: $spacing-8;
  margin: 0;
  font-size: $font-size-xs;
}

.reviewSubmitDialog_where {
  flex: none;
  font-family: $font-family-mono;
  font-size: 11.5px;
  color: $color-fg-2;
}

.reviewSubmitDialog_excerpt {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewSubmitDialog_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;
}

.reviewSubmitDialog_note {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewSubmitDialog .reviewSubmitDialog_send_APPROVE {
  background: $color-green;
  border-color: $color-green;
}

.reviewSubmitDialog .reviewSubmitDialog_send_REQUEST_CHANGES {
  background: $color-red;
  border-color: $color-red;
}
</style>
