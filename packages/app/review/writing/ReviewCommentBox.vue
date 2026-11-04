<!-- `Review / Comment box`: where it goes, the text, and two buttons carrying their label and key, which is all it says (D33): `⌘↵` and `⌘⇧↵` do what they name, the choice of a single comment or a draft (D17), and with a draft open a comment can only join it, the second key adding it and submitting all of it (D22). They act only from here. What GitHub refused shows between the text and the buttons, the text staying. Escape leaves the box with its text in it, or closes an empty one; every other key typed stays in the field. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import TextArea from '@/components/TextArea.vue';

import * as l from './ReviewCommentBox.loc.js';
import type { ReviewCommentTarget, ReviewCommentWay, ReviewWriteFailure } from './ReviewWriting.js';

const props = defineProps<{
  target: ReviewCommentTarget;
  /** A comment can only join a draft. */
  draftOpen: boolean;
  /** How many the draft has without this one. */
  draftCount: number;
  /** `⌘↵` starts a draft rather than sends at once, when none is open: the setting of D17. */
  draftFirst: boolean;
  failure: ReviewWriteFailure | null;
  /** The keys are in this box: it takes the focus when it is drawn, and when this turns on. */
  focused: boolean;
}>();

const emit = defineEmits<{
  send: [way: ReviewCommentWay];
  /** Escape. */
  leave: [];
  focus: [];
  blur: [];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const FIRST_KEY = 'Mod+Enter';
const SECOND_KEY = 'Mod+Shift+Enter';
const t = useTranslate();
const field = useTemplateRef<InstanceType<typeof TextArea>>('field');

const where = computed(() => {
  const { startLine, line } = props.target;
  return startLine === null ? t(l.onLine, { line }) : t(l.onLines, { start: startLine, end: line });
});
const hasText = computed(() => text.value.trim() !== '');
const first = computed((): { way: ReviewCommentWay; label: string } => {
  if (props.draftOpen) {
    return { way: 'joinDraft', label: t(l.addToDraft) };
  }

  return props.draftFirst ? { way: 'startDraft', label: t(l.startReview) } : { way: 'single', label: t(l.comment) };
});
const second = computed((): { way: ReviewCommentWay; label: string } => {
  if (props.draftOpen) {
    return { way: 'joinAndSubmit', label: t(l.submitDraft, { count: props.draftCount + 1 }) };
  }

  return props.draftFirst ? { way: 'single', label: t(l.commentNow) } : { way: 'startDraft', label: t(l.startReview) };
});
const failureText = computed(() => {
  const { failure } = props;
  switch (failure?.kind) {
    case undefined:
      return null;
    case 'refused':
      return t(l.refused, { reason: failure.message });
    case 'notReached':
      return t(l.notReached);
    case 'noDraft':
      return t(l.noDraft);
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

function onKeydown(event: KeyboardEvent) {
  if (matchesCommandKey(event, FIRST_KEY)) {
    event.preventDefault();
    send(first.value.way);
  } else if (matchesCommandKey(event, SECOND_KEY)) {
    event.preventDefault();
    send(second.value.way);
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
    <p :class="css.reviewCommentBox_where">{{ where }}</p>
    <TextArea
      ref="field"
      v-model="text"
      :label="where"
      label-hidden
      :placeholder="t(l.placeholder)"
      compact
      :aria-keyshortcuts="`${formatAriaKeyShortcuts(FIRST_KEY)} ${formatAriaKeyShortcuts(SECOND_KEY)}`"
      @keydown="onKeydown"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <p
      v-if="failureText !== null"
      :class="css.reviewCommentBox_failure"
      role="alert"
    >
      <CircleAlert
        :class="css.reviewCommentBox_failureIcon"
        aria-hidden="true"
      />
      {{ failureText }}
    </p>
    <div :class="css.reviewCommentBox_footer">
      <Button
        size="sm"
        :disabled="!hasText"
        :kbd="SECOND_KEY"
        @click="send(second.way)"
      >
        {{ second.label }}
      </Button>
      <Button
        size="sm"
        variant="light"
        :disabled="!hasText"
        :kbd="FIRST_KEY"
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

.reviewCommentBox_where {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.reviewCommentBox_failure {
  display: flex;
  gap: $spacing-6;
  align-items: baseline;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-red;
  overflow-wrap: anywhere;
}

.reviewCommentBox_failureIcon {
  flex: none;
  align-self: center;
  width: 13px;
  height: 13px;
}

.reviewCommentBox_footer {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8;
  justify-content: flex-end;
}
</style>
