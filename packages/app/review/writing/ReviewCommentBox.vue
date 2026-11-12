<!-- `Review / New comment` (D39): the shared Markdown editor, headed by where it goes, with what is typed, and two buttons carrying their label and key, which is all it says (D33): `⌘↵` and `⌘⇧↵` do what they name, the choice of a single comment or a draft (D17), and with a draft open a comment can only join it, the second key adding it and submitting all of it (D22). They act only from here. Between the head and the editor, an amber line once the code has changed under a comment (D33, CR87), said politely and moving no focus, and what GitHub refused, the text staying. A reply (`Review / Thread · replying`) says who it answers and its buttons are the reply's. `⌘G` or "Suggest a change", first in the editor's tools where GitHub would take one, puts a suggestion block at the cursor, of the commented lines as they are (D18); `⇧↓` in an empty box takes in the next line (CR73), and with text in it selects text as anywhere. Escape or Cancel closes an empty box; on one with text the footer asks instead (D40, `· asks to discard`, CR97): "Discard what you wrote?", Keep writing (Escape) and Discard (Enter). The cursor stays in the text, so Enter there discards rather than starting a line, typing anything takes the question away, and Escape again keeps writing. Every other key typed stays in the field, and the keys it acts on there are announced on it. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleHelp, FileDiff, TriangleAlert } from 'lucide-vue-next';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import Button from '@/components/Button.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';

import { REVIEW_KEYS } from '../useReviewKeySheet.js';
import { getCommentWays } from './getCommentWays.js';
import * as l from './ReviewCommentBox.loc.js';
import ReviewFailureNote from './ReviewFailureNote.vue';
import type { ReviewCommentFailure, ReviewCommentTarget, ReviewCommentWay } from './ReviewWriting.js';
import { useCommentFailureText } from './useCommentFailureText.js';

const props = defineProps<{
  target: ReviewCommentTarget;
  /** `owner/name` of the pull request, which the preview and `@` `#` suggestions are of. */
  repository: string;
  /** The pull request's number, which `#` does not suggest. */
  itemNumber: number;
  /** A comment can only join a draft. */
  draftOpen: boolean;
  /** How many the draft has without this one. */
  draftCount: number;
  /** `⌘↵` starts a draft rather than sends at once, when none is open: the setting of D17. */
  draftFirst: boolean;
  failure: ReviewCommentFailure | null;
  /** The head has moved on from the one its lines were chosen on. */
  codeChanged?: boolean;
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
  /** Escape or Cancel on an empty box. */
  leave: [];
  /** Discard, asked on a box with text. */
  discard: [];
  /** The focus came into the box, from outside it. */
  focus: [];
  /** The focus left the box. */
  blur: [];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const t = useTranslate();
const getFailureText = useCommentFailureText();
const editor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor');
/** Its footer asks whether to discard what is written. */
const asking = ref(false);

const isReply = computed(() => props.target.threadId !== null);
const where = computed(() => {
  const { startLine, line } = props.target;
  if (isReply.value) {
    return props.replyTo ? t(l.replyTo, { who: props.replyTo }) : t(l.replyInThread);
  }

  return startLine === null ? t(l.onLine, { line }) : t(l.onLines, { start: startLine, end: line });
});
const hasText = computed(() => text.value.trim() !== '');
const ways = computed(() => getCommentWays(props.draftOpen, props.draftFirst));
const first = computed(() => ({ way: ways.value.first, label: getLabel(ways.value.first) }));
const second = computed(() => ({ way: ways.value.second, label: getLabel(ways.value.second) }));
const failureText = computed(() => (props.failure ? getFailureText(props.failure) : null));
/** While it asks, Enter and Escape answer from the text; else the two ways to send go from there. */
const fieldKeys = computed(() =>
  asking.value
    ? 'Enter Escape'
    : `${formatAriaKeyShortcuts(REVIEW_KEYS.sendFirst)} ${formatAriaKeyShortcuts(REVIEW_KEYS.sendSecond)}`,
);
const suggestTool = computed(() =>
  props.suggestion ? { label: t(l.suggest), icon: FileDiff, keys: REVIEW_KEYS.suggest } : null,
);

onMounted(takeFocus);
watch(() => props.focused, takeFocus);

/** Moving nothing: a box only comes back into the window near the screen, and what is being read stays (D7). */
async function takeFocus() {
  if (props.focused) {
    await editor.value?.focus();
  }
}

function getLabel(way: ReviewCommentWay) {
  switch (way) {
    case 'single':
      if (props.draftFirst) {
        return isReply.value ? t(l.replyNow) : t(l.commentNow);
      }

      return isReply.value ? t(l.reply) : t(l.comment);
    case 'startDraft':
      return t(l.startReview);
    case 'joinDraft':
      return t(l.addToDraft);
    case 'joinAndSubmit':
      return t(l.submitDraft, { count: props.draftCount + 1 });
    default:
      return assertNever(way);
  }
}

function send(way: ReviewCommentWay) {
  if (hasText.value && !asking.value) {
    emit('send', way);
  }
}

/** On a line of its own at the cursor, with the cursor at the end of the code, to change it. */
function insertSuggestion() {
  const block = props.suggestion;
  const cursor = editor.value?.getSelection();
  if (!block || !cursor) {
    return;
  }

  const before = text.value.slice(0, cursor.start);
  const after = text.value.slice(cursor.end);
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const trail = after === '' || after.startsWith('\n') ? '' : '\n';
  editor.value?.insert(`${lead}${block}${trail}`, lead.length + block.lastIndexOf('\n'));
}

/** Escape and Cancel: an empty box closes, one with text asks; Escape on the question keeps writing. */
function leave() {
  if (asking.value) {
    keepWriting();
  } else if (hasText.value) {
    asking.value = true;
    // From Cancel, the cursor goes back to the text, where the question is answered.
    void editor.value?.focus();
  } else {
    emit('leave');
  }
}

// Taken here: the screen does not take Escape as leaving the review.
function onEscape(event: KeyboardEvent) {
  event.preventDefault();
  leave();
}

// Not awaited: a click listener's promise would show the button busy.
function keepWriting() {
  asking.value = false;
  void editor.value?.focus();
}

function discard() {
  asking.value = false;
  emit('discard');
}

/** Anything typed takes the question away: the user went back to writing. */
function onInput() {
  asking.value = false;
}

// Moving between its text, tools and buttons, the focus stays in the box.
function onFocusIn(event: FocusEvent) {
  if (!isInside(event)) {
    emit('focus');
  }
}

function onFocusOut(event: FocusEvent) {
  if (!isInside(event)) {
    emit('blur');
  }
}

function isInside({ currentTarget, relatedTarget }: FocusEvent) {
  return currentTarget instanceof Node && relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
}

// After the editor's: `⌘↵` it reports as `submit`, and a key its suggestions took is theirs.
function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }

  // Enter answers the question, rather than starting a line.
  if (asking.value && event.key === 'Enter' && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    discard();
  } else if (matchesCommandKey(event, REVIEW_KEYS.sendSecond)) {
    event.preventDefault();
    send(second.value.way);
  } else if (matchesCommandKey(event, REVIEW_KEYS.suggest)) {
    event.preventDefault();
    insertSuggestion();
  } else if (matchesCommandKey(event, REVIEW_KEYS.extendComment) && !isReply.value && text.value === '') {
    event.preventDefault();
    emit('extend');
  }
}
</script>

<template>
  <div
    :class="css.reviewCommentBox"
    role="group"
    :aria-label="where"
    @keydown="onKeydown"
    @input="onInput"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <p :class="css.reviewCommentBox_where">{{ where }}</p>
    <!-- There before its line, or a screen reader may not announce it; taking no room, it adds no gap until then. -->
    <div
      :class="css.reviewCommentBox_status"
      role="status"
    >
      <p
        v-if="codeChanged"
        :class="css.reviewCommentBox_changed"
      >
        <TriangleAlert
          :class="css.reviewCommentBox_changedIcon"
          aria-hidden="true"
        />
        {{ t(l.codeChanged) }}
      </p>
    </div>
    <ReviewFailureNote
      v-if="failureText !== null"
      :text="failureText"
    />
    <MarkdownEditor
      ref="editor"
      v-model="text"
      :class="css.reviewCommentBox_editor"
      :repository="repository"
      :item-number="itemNumber"
      :label="where"
      :placeholder="t(l.placeholder)"
      :tool="suggestTool"
      :keyshortcuts="fieldKeys"
      @tool="insertSuggestion"
      @submit="send(first.way)"
      @cancel="onEscape"
    >
      <template
        v-if="asking"
        #status
      >
        <CircleHelp
          :class="css.reviewCommentBox_questionIcon"
          aria-hidden="true"
        />
        <span
          :class="css.reviewCommentBox_question"
          role="status"
          >{{ t(l.discardQuestion) }}</span
        >
      </template>
      <template
        v-if="asking"
        #footer
      >
        <Button
          size="compact"
          kbd="Escape"
          keyshortcuts="Escape"
          @click="keepWriting"
        >
          {{ t(l.keepWriting) }}
        </Button>
        <Button
          size="compact"
          variant="destructive"
          kbd="Enter"
          keyshortcuts="Enter"
          @click="discard"
        >
          {{ t(l.discard) }}
        </Button>
      </template>
      <template
        v-else
        #footer
      >
        <Button
          size="compact"
          kbd="Escape"
          keyshortcuts="Escape"
          @click="leave"
        >
          {{ t(l.cancel) }}
        </Button>
        <Button
          size="compact"
          :disabled="!hasText"
          :kbd="REVIEW_KEYS.sendSecond"
          :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.sendSecond)"
          @click="send(second.way)"
        >
          {{ second.label }}
        </Button>
        <Button
          size="compact"
          variant="primary"
          :disabled="!hasText"
          :kbd="REVIEW_KEYS.sendFirst"
          :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.sendFirst)"
          @click="send(first.way)"
        >
          {{ first.label }}
        </Button>
      </template>
    </MarkdownEditor>
  </div>
</template>

<style lang="scss" module="css">
.reviewCommentBox {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.reviewCommentBox_where {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// Out of the flow while empty: no gap, and still there for a screen reader to be listening to.
.reviewCommentBox_status:empty {
  position: absolute;
}

.reviewCommentBox_changed {
  display: flex;
  gap: $spacing-6;
  align-items: baseline;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-amber;
}

.reviewCommentBox_changedIcon {
  flex: none;
  align-self: center;
  width: 13px;
  height: 13px;
}

.reviewCommentBox_question {
  font-size: $font-size-xs;
  color: $color-fg;
}

.reviewCommentBox_questionIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

// Twice the class: the editor's own border comes from a stylesheet that may load after this one. In the accent while
// open, focused or not: it is what is being written.
.reviewCommentBox_editor.reviewCommentBox_editor {
  border-color: $color-accent;
}
</style>
