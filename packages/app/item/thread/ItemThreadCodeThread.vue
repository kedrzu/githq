<!-- A thread on the code in an item's thread (`Activity / Code thread`, F5, F12): one card with the code it was written on (`ItemThreadExcerpt`) and its comments (`ReviewComment`), then the bands code review's threads close with too (`ReviewThreadBands`): one with the viewer's avatar and "Reply…", then one with Resolve thread — or, resolved, Unresolve and who resolved it. Reply and Resolve / Unresolve are offered only where GitHub says the viewer may (`viewerCanReply`, `viewerCanResolve`, `viewerCanUnresolve`). A resolved one, opened from its folded row (`ItemThreadResolvedRow`), has a head with Hide, which folds it again: an empty reply box closes with it, one with text or refused asks first as its Cancel does, a reply on its way goes on. A thread of the viewer's draft review (`draft`) has neither band: its comments reach nobody yet. "Reply…" opens the reply editor in its band (`Activity / Code thread · replying`, F10), growing downwards: Cancel (`Escape`) and Reply (`Mod+Enter`), the question before a reply with text is let go; a reply sent shows at once among the comments, "Sending…" or "Pending" as code review says, and one GitHub refused comes back in the editor with why, its text kept (`CodeThreadReplies`). A change of state, or a deletion, GitHub didn't take says so in the resolve band. Given the view's comment actions (`commentActions`), each comment has its ⋯ (Edit in place, Quote reply into this thread's reply box where it takes one, so not in the draft, Copy link, Delete) and shows an edit on its way. Each comment carries GitHub's anchor (`discussion_r<id>`) as its `id`; while the address names one of them, it is the location and the card's border is in the accent, as the thread's linked comment, and the address brings the card into view from its top, its code above the comment, as long as the comment still fits (`data-route-scroll-frame`). The card takes the focus (`data-code-thread`) when clicked or moved to with J/K (`ItemThread`); while the focus is in it, "Reply…" shows its key, `R`, as code review's focused thread does. Each of its comments is a stop of the reading cursor, keyed by the comment's id: the cursor on one tints its part of the card, edge to edge, as code review's cursor line (`Review / Comment · current`), and makes it `aria-current` — unless it is the linked one, which stays the location; edited in place, the comment keeps the stop around its editor. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, CircleCheck } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { comment as commentCommand } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import CommentEditor from '@/comments/CommentEditor.vue';
import Button from '@/components/Button.vue';
import ReviewComment from '@/review/threads/ReviewComment.vue';
import type { ReviewCommentActions } from '@/review/threads/ReviewCommentActions.js';
import type { ReviewThread, ReviewThreadComment } from '@/review/threads/ReviewThread.js';
import ReviewThreadBands from '@/review/threads/ReviewThreadBands.vue';
import { useReadingStops } from '@/reading/ReadingCursor.js';
import ReviewFailureNote from '@/review/writing/ReviewFailureNote.vue';
import ReviewSentComment from '@/review/writing/ReviewSentComment.vue';
import type { ReviewWriteFailure } from '@/review/writing/ReviewWriting.js';
import { useCommentFailureText } from '@/review/writing/useCommentFailureText.js';
import { useThreadFailureText } from '@/review/writing/useThreadFailureText.js';
import type { ItemUser } from '@/store/ItemTypes.js';
import { isFocusStayingInside } from '@/utils/isFocusStayingInside.js';

import type { CodeThreadReplies } from './CodeThreadReplies.js';
import { getUrlAnchor } from './getUrlAnchor.js';
import { holdsAnchor } from './holdsAnchor.js';
import * as l from './ItemThreadCodeThread.loc.js';
import ItemThreadExcerpt from './ItemThreadExcerpt.vue';

const props = defineProps<{
  thread: ReviewThread;
  /** Who is signed in: the reply band's avatar. */
  viewer?: ItemUser | null;
  /** In the viewer's draft review: no reply or resolve. */
  draft?: boolean;
  /** The viewer's replies and what writes them; none, "Reply…" only says it was clicked. */
  replies?: CodeThreadReplies | null;
  /** The anchor the address's fragment names (`discussion_r…`): the comment with it is marked. */
  linkedAnchor?: string;
  /** Why deleting one of its comments didn't go through. */
  deleteFailure?: ReviewWriteFailure | null;
  /** What the view does with its comments, from their ⋯; none, no ⋯. */
  commentActions?: ReviewCommentActions | null;
}>();

const emit = defineEmits<{
  /** Fold the resolved thread again: its reply box closed, or let go once asked; a reply on its way goes on. */
  hide: [];
  /** "Reply…" was clicked. */
  reply: [];
  /** Resolve thread, or Unresolve. */
  setResolved: [resolved: boolean];
}>();

const t = useTranslate();
const getCommentFailureText = useCommentFailureText();
const getThreadFailureText = useThreadFailureText();
const isCurrent = useReadingStops();

/** One of its comments is the one the address names. */
const linked = computed(() => holdsAnchor(props.thread, props.linkedAnchor));
const who = computed(() => props.thread.comments[0]?.author?.login ?? t(l.ghost));
const canReply = computed(() => !props.draft && props.thread.viewerCanReply);
const canToggle = computed(
  () => !props.draft && (props.thread.isResolved ? props.thread.viewerCanUnresolve : props.thread.viewerCanResolve),
);
/** Who resolved it, when GitHub says. */
const resolver = computed(() => (props.thread.isResolved ? props.thread.resolvedBy : null));
const reply = computed(() => props.replies?.get(props.thread.id) ?? null);
const box = computed(() => reply.value?.box ?? null);
const failureTexts = computed(() => {
  const texts: string[] = [];
  const resolveFailure = props.replies?.getResolveFailure(props.thread.id) ?? null;
  if (resolveFailure) {
    texts.push(getThreadFailureText(resolveFailure, props.thread.isResolved ? 'unresolve' : 'resolve'));
  }

  if (props.deleteFailure) {
    texts.push(getThreadFailureText(props.deleteFailure, 'delete'));
  }

  return texts;
});
/** The focus is in the thread: `R` opens its reply editor, as on code review's focused thread. */
const focused = ref(false);
const replyKey = computed(() => (focused.value && props.replies ? keyOf(commentCommand) : undefined));
/** Hide asked whether to discard the reply: Discard folds the thread too. */
const hiding = ref(false);

/** An empty reply box closes with it; one with text, or refused, asks first, as its Cancel does. */
function hide() {
  const open = box.value;
  if (open?.changed && props.replies) {
    hiding.value = true;
    props.replies.setAsking(props.thread.id, true);
    return;
  }

  if (open) {
    props.replies?.cancel(props.thread.id);
  }

  emit('hide');
}

function setAsking(asking: boolean) {
  if (!asking) {
    hiding.value = false;
  }

  props.replies?.setAsking(props.thread.id, asking);
}

function cancelReply() {
  props.replies?.cancel(props.thread.id);
  if (hiding.value) {
    hiding.value = false;
    emit('hide');
  }
}

function isLinked(comment: ReviewThreadComment) {
  return props.linkedAnchor !== undefined && getUrlAnchor(comment.url) === props.linkedAnchor;
}

function onFocusOut(event: FocusEvent) {
  focused.value = isFocusStayingInside(event);
}
</script>

<template>
  <div
    role="group"
    :aria-label="t(l.label, { who, path: thread.path })"
    :class="[css.itemThreadCodeThread, linked && css.itemThreadCodeThread_linked]"
    :data-code-thread="thread.id"
    data-route-scroll-frame
    tabindex="-1"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <p
      v-if="thread.isResolved"
      :class="css.itemThreadCodeThread_resolvedHead"
    >
      <ChevronDown
        :class="css.itemThreadCodeThread_chevron"
        aria-hidden="true"
      />
      <CircleCheck
        :class="css.itemThreadCodeThread_check"
        aria-hidden="true"
      />
      <span :class="css.itemThreadCodeThread_state">{{ t(l.resolved) }}</span>
      <span :class="css.itemThreadCodeThread_spacer" />
      <Button
        variant="link"
        tone="accent"
        :class="css.itemThreadCodeThread_hide"
        aria-expanded="true"
        @click="hide"
      >
        {{ t(l.hide) }}
      </Button>
    </p>
    <div :class="css.itemThreadCodeThread_body">
      <ItemThreadExcerpt :thread="thread" />
      <ReviewComment
        v-for="comment in thread.comments"
        :id="getUrlAnchor(comment.url)"
        :key="comment.id"
        :comment-id="comment.id"
        :author="comment.author"
        :created-at="comment.createdAt"
        :url="comment.url"
        :edited="comment.lastEditedAt !== null"
        :in-draft="comment.state === 'PENDING'"
        :html="comment.bodyHTML"
        :actions="commentActions"
        :body="comment.body"
        :can-edit="comment.viewerCanUpdate"
        :can-delete="comment.viewerCanDelete"
        :can-quote="canReply && replies != null"
        :class="isCurrent(comment.id) && css.itemThreadCodeThread_current"
        :data-reading-stop="comment.id"
        data-reading-stop-kind="comment"
        :aria-current="isLinked(comment) ? 'location' : isCurrent(comment.id) || undefined"
      />
      <ReviewSentComment
        v-for="sent in reply?.sent ?? []"
        :key="sent.id"
        :status="sent.status"
        :author="viewer ?? null"
      />
    </div>
    <ReviewThreadBands
      :viewer="viewer"
      :can-reply="canReply"
      :reply-key="replyKey"
      :can-toggle="canToggle"
      :resolved="thread.isResolved"
      :resolver="resolver?.login"
      @reply="emit('reply')"
      @set-resolved="emit('setResolved', $event)"
    >
      <template
        v-if="canReply && box && replies"
        #box
      >
        <CommentEditor
          :text="box.text"
          kind="reply"
          :save-label="replies.saveLabel"
          :repository="replies.repository"
          :item-number="replies.itemNumber"
          :people="replies.people"
          :autofocus="box.focused"
          :changed="box.changed"
          :asking="box.asking"
          @update:text="replies.setText(thread.id, $event)"
          @update:asking="setAsking"
          @save="replies.send(thread.id)"
          @cancel="cancelReply"
        />
        <ReviewFailureNote
          v-if="box.failure"
          :text="getCommentFailureText(box.failure)"
        />
      </template>
      <template
        v-if="failureTexts.length > 0"
        #notes
      >
        <ReviewFailureNote
          v-for="text in failureTexts"
          :key="text"
          :text="text"
        />
      </template>
    </ReviewThreadBands>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadCodeThread {
  @include focus-ring;

  min-width: 0;
  overflow: hidden;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.itemThreadCodeThread_linked {
  border-color: $color-accent;
}

.itemThreadCodeThread_resolvedHead {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  margin: 0;
  border-bottom: 1px solid $color-border;
}

.itemThreadCodeThread_chevron {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.itemThreadCodeThread_check {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-green;
}

.itemThreadCodeThread_state {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.itemThreadCodeThread_spacer {
  flex: 1;
}

.itemThreadCodeThread_hide {
  font-size: $font-size-xs;
}

.itemThreadCodeThread_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-14;
  padding: $spacing-12;
}

// The comment under the reading cursor: a tint from the card's edge to its edge, halfway into the gaps above and below,
// behind what it says. A fill only, so nothing moves.
.itemThreadCodeThread_current {
  position: relative;
  isolation: isolate;

  &::before {
    position: absolute;
    inset: (-$spacing-14 * 0.5) (-$spacing-12);
    z-index: -1;
    content: '';
    background: $color-cursor-tint;
  }
}
</style>
