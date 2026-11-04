<!-- `Review / Comment box`: where it goes, the text, and two buttons carrying their label and key, which is all it says (D33): `⌘↵` and `⌘⇧↵` do what they name, the choice of a single comment or a draft (D17), and with a draft open a comment can only join it, the second key adding it and submitting all of it (D22). They act only from here. What GitHub refused shows between the text and the buttons, the text staying. A reply says who it answers and its buttons are the reply's. `⌘G` or "Suggest a change", where GitHub would take one, puts a suggestion block at the cursor, of the commented lines as they are (D18); `⇧↓` in an empty box takes in the next line (CR73), and with text in it selects text as anywhere. Escape leaves the box with its text in it, or closes an empty one; every other key typed stays in the field. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { FilePenLine } from 'lucide-vue-next';
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import TextArea from '@/components/TextArea.vue';

import { REVIEW_KEYS } from '../useReviewKeySheet.js';
import * as l from './ReviewCommentBox.loc.js';
import ReviewFailureNote from './ReviewFailureNote.vue';
import type { ReviewCommentFailure, ReviewCommentTarget, ReviewCommentWay } from './ReviewWriting.js';

const props = defineProps<{
  target: ReviewCommentTarget;
  /** A comment can only join a draft. */
  draftOpen: boolean;
  /** How many the draft has without this one. */
  draftCount: number;
  /** `⌘↵` starts a draft rather than sends at once, when none is open: the setting of D17. */
  draftFirst: boolean;
  failure: ReviewCommentFailure | null;
  /** The keys are in this box: it takes the focus when it is drawn, and when this turns on. */
  focused: boolean;
  /** Who a reply answers; `null` if that isn't known. */
  replyTo?: string | null;
  /** The block `⌘G` inserts; `null` where GitHub wouldn't take a suggestion. */
  suggestion?: string | null;
}>();

const emit = defineEmits<{
  send: [way: ReviewCommentWay];
  /** `⇧↓` in an empty box. */
  extend: [];
  /** Escape. */
  leave: [];
  focus: [];
  blur: [];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const t = useTranslate();
const field = useTemplateRef<InstanceType<typeof TextArea>>('field');

const isReply = computed(() => props.target.threadId !== null);
const where = computed(() => {
  const { startLine, line } = props.target;
  if (isReply.value) {
    return props.replyTo ? t(l.replyTo, { who: props.replyTo }) : t(l.replyInThread);
  }

  return startLine === null ? t(l.onLine, { line }) : t(l.onLines, { start: startLine, end: line });
});
const hasText = computed(() => text.value.trim() !== '');
const first = computed((): { way: ReviewCommentWay; label: string } => {
  if (props.draftOpen) {
    return { way: 'joinDraft', label: t(l.addToDraft) };
  }

  return props.draftFirst
    ? { way: 'startDraft', label: t(l.startReview) }
    : { way: 'single', label: isReply.value ? t(l.reply) : t(l.comment) };
});
const second = computed((): { way: ReviewCommentWay; label: string } => {
  if (props.draftOpen) {
    return { way: 'joinAndSubmit', label: t(l.submitDraft, { count: props.draftCount + 1 }) };
  }

  return props.draftFirst
    ? { way: 'single', label: isReply.value ? t(l.replyNow) : t(l.commentNow) }
    : { way: 'startDraft', label: t(l.startReview) };
});
const failureText = computed(() => {
  const { failure } = props;
  switch (failure?.kind) {
    case undefined:
      return null;
    case 'refused':
      return failure.message === null ? t(l.refusedNoReason) : t(l.refused, { reason: failure.message });
    case 'notReached':
      return t(l.notReached);
    case 'noDraft':
      return t(l.noDraft);
    case 'draftFound':
      return t(l.draftFound);
    default:
      return assertNever(failure);
  }
});

onMounted(takeFocus);
watch(() => props.focused, takeFocus);

/** Moving nothing: a box only comes back into the window near the screen, and what is being read stays (D7). */
function takeFocus() {
  if (props.focused) {
    field.value?.focus({ preventScroll: true });
  }
}

function send(way: ReviewCommentWay) {
  if (hasText.value) {
    emit('send', way);
  }
}

/** On a line of its own at the cursor, with the cursor at the end of the code, to change it. */
async function insertSuggestion() {
  const block = props.suggestion;
  const cursor = field.value?.getSelection();
  if (!block || !cursor) {
    return;
  }

  const before = text.value.slice(0, cursor.start);
  const after = text.value.slice(cursor.end);
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const trail = after === '' || after.startsWith('\n') ? '' : '\n';
  text.value = `${before}${lead}${block}${trail}${after}`;
  const end = before.length + lead.length + block.lastIndexOf('\n');
  await nextTick();
  field.value?.focus({ preventScroll: true });
  field.value?.setSelection(end, end);
}

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, REVIEW_KEYS.sendFirst)) {
    event.preventDefault();
    send(first.value.way);
  } else if (matchesCommandKey(event, REVIEW_KEYS.sendSecond)) {
    event.preventDefault();
    send(second.value.way);
  } else if (matchesCommandKey(event, REVIEW_KEYS.suggest)) {
    event.preventDefault();
    void insertSuggestion();
  } else if (matchesCommandKey(event, REVIEW_KEYS.extendComment) && !isReply.value && text.value === '') {
    event.preventDefault();
    emit('extend');
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('leave');
  }
}
</script>

<template>
  <div
    :class="css.reviewCommentBox"
    role="group"
    :aria-label="where"
  >
    <div :class="css.reviewCommentBox_head">
      <p :class="css.reviewCommentBox_where">{{ where }}</p>
      <Button
        v-if="suggestion"
        :class="css.reviewCommentBox_suggest"
        variant="field"
        size="sm"
        :icon="FilePenLine"
        :kbd="REVIEW_KEYS.suggest"
        :aria-keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.suggest)"
        @click="insertSuggestion"
      >
        {{ t(l.suggest) }}
      </Button>
    </div>
    <TextArea
      ref="field"
      v-model="text"
      :label="where"
      label-hidden
      :placeholder="t(l.placeholder)"
      compact
      :aria-keyshortcuts="`${formatAriaKeyShortcuts(REVIEW_KEYS.sendFirst)} ${formatAriaKeyShortcuts(REVIEW_KEYS.sendSecond)}`"
      @keydown="onKeydown"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <ReviewFailureNote
      v-if="failureText !== null"
      :text="failureText"
    />
    <div :class="css.reviewCommentBox_footer">
      <Button
        size="sm"
        :disabled="!hasText"
        :kbd="REVIEW_KEYS.sendSecond"
        :aria-keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.sendSecond)"
        @click="send(second.way)"
      >
        {{ second.label }}
      </Button>
      <Button
        size="sm"
        variant="light"
        :disabled="!hasText"
        :kbd="REVIEW_KEYS.sendFirst"
        :aria-keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.sendFirst)"
        @click="send(first.way)"
      >
        {{ first.label }}
      </Button>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewCommentBox {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-12;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.reviewCommentBox_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewCommentBox_head .reviewCommentBox_suggest {
  flex: none;
  gap: $spacing-6;
  padding: 3px 7px;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  cursor: pointer;
  background: none;
  border-color: $color-border-2;
}

.reviewCommentBox_where {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.reviewCommentBox_footer {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  justify-content: flex-end;
}
</style>
