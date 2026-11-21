<!-- A thread on the code in an item's thread (`Activity / Code thread`, F5, F12): one card with the code it was written on (`ItemThreadExcerpt`, in its own row padded 12 px around but below) and its comments under it (`ReviewComment`), each its own padded box edge to edge, a 1 px divider between two, as on GitHub, then the bands code review's threads close with too (`ReviewThreadBands`): one with the viewer's avatar and "Reply…", then one with Resolve thread — or, resolved, Unresolve and who resolved it. Reply and Resolve / Unresolve are offered only where GitHub says the viewer may (`viewerCanReply`, `viewerCanResolve`, `viewerCanUnresolve`). A resolved one, opened from its folded row (`ItemThreadResolvedRow`), has a head with Hide, which folds it again: an empty reply box closes with it, one with text or refused asks first as its Cancel does, a reply on its way goes on. A thread of the viewer's draft review (`draft`) has neither band: its comments reach nobody yet. "Reply…" opens the reply editor in its band (`Activity / Code thread · replying`, F10), growing downwards: Cancel (`Escape`) and Reply (`Mod+Enter`), the question before a reply with text is let go; a reply sent shows at once among the comments, "Sending…" or "Pending" as code review says, and one GitHub refused comes back in the editor with why, its text kept (`CodeThreadReplies`). A change of state, or a deletion, GitHub didn't take says so in the resolve band. Given the view's comment actions (`commentActions`), each comment has its ⋯ (Edit in place, Quote reply into this thread's reply box where it takes one, so not in the draft, Copy link, Delete) and shows an edit on its way. Each comment carries GitHub's anchor (`discussion_r<id>`) as its `id`; while the address names one of them, it is the location, and where no reading cursor is shown (an item's panel, a phone, code review) the card's border is `current-edge`, as the thread's linked comment — on an item's page the cursor starts on it instead — and the address brings the card into view from its top, its code above the comment, as long as the comment still fits (`data-route-scroll-frame`). The card takes the focus (`data-code-thread`) when clicked or moved to with J/K (`ItemThread`); while the focus is in it, "Reply…" shows its key, `R`, as code review's focused thread does. The card is a row stop of the reading cursor (`thread:<id>`, the key of its folded row), and each of its comments one inside it, keyed by the comment's id: the cursor on the card or on one of its comments turns the card's border `current-edge`, as a comment card under it (`CommentCard`), and makes it `aria-current`; on a comment it also tints that comment's part of the card, edge to edge, faintly (`current-tint`, 8 %, over its whole box, divider to divider), with its code above when it is the first comment (`F37`, `F38`), and makes it `aria-current` too; edited in place, the comment keeps the stop around its editor. While the cursor is on the card or in it, "Reply…" shows `R` and Resolve thread or Unresolve `H`, where the viewer may write them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, CircleCheck } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { comment as commentCommand, resolveThread } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import CommentEditor from '@/comments/CommentEditor.vue';
import Button from '@/components/Button.vue';
import MotionList from '@/components/MotionList.vue';
import ReviewComment from '@/review/threads/ReviewComment.vue';
import type { ReviewCommentActions } from '@/review/threads/ReviewCommentActions.js';
import type { ReviewThread, ReviewThreadComment } from '@/review/threads/ReviewThread.js';
import ReviewThreadBands from '@/review/threads/ReviewThreadBands.vue';
import { useReadingCursorShown, useReadingStop, useReadingStops } from '@/reading/ReadingCursor.js';
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
const getStopState = useReadingStops();
const cursorShown = useReadingCursorShown();
const stopKey = computed(() => `thread:${props.thread.id}`);
const stop = useReadingStop(stopKey);

/**
 * One of its comments is the one the address names: the `current-edge` border, where no reading cursor is shown — on the page
 * the cursor starts there instead.
 */
const linked = computed(() => !cursorShown.value && holdsAnchor(props.thread, props.linkedAnchor));
/** The reading cursor is on it, or on one of its comments: marked, and its keys `R` and `H` act on it. */
const marked = computed(() => stop.current || stop.within);
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
const replyKey = computed(() => ((focused.value || marked.value) && props.replies ? keyOf(commentCommand) : undefined));
/** `H` resolves it, or unresolves it, while the reading cursor is in it. */
const resolveKey = computed(() => (marked.value && props.replies ? keyOf(resolveThread) : undefined));
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
  return !cursorShown.value && props.linkedAnchor !== undefined && getUrlAnchor(comment.url) === props.linkedAnchor;
}

function onFocusOut(event: FocusEvent) {
  focused.value = isFocusStayingInside(event);
}
</script>

<template>
  <div
    role="group"
    :aria-label="t(l.label, { who, path: thread.path })"
    :class="[
      css.itemThreadCodeThread,
      marked && css.itemThreadCodeThread_current,
      linked && css.itemThreadCodeThread_linked,
    ]"
    :data-code-thread="thread.id"
    :data-reading-stop="stopKey"
    data-reading-stop-kind="row"
    :aria-current="marked || undefined"
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
    <!-- A reply arriving fades in; one sent, on its way, gives its place to GitHub's comment. -->
    <MotionList
      tag="div"
      :class="css.itemThreadCodeThread_body"
    >
      <div
        key="excerpt"
        :class="css.itemThreadCodeThread_excerpt"
      >
        <ItemThreadExcerpt :thread="thread" />
      </div>
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
        :class="getStopState(comment.id) === 'current' && css.itemThreadCodeThread_currentComment"
        :data-reading-stop="comment.id"
        data-reading-stop-kind="comment"
        :aria-current="isLinked(comment) ? 'location' : getStopState(comment.id) === 'current' || undefined"
      />
      <ReviewSentComment
        v-for="sent in reply?.sent ?? []"
        :key="sent.id"
        :status="sent.status"
        :author="viewer ?? null"
      />
    </MotionList>
    <ReviewThreadBands
      :viewer="viewer"
      :can-reply="canReply"
      :reply-key="replyKey"
      :resolve-key="resolveKey"
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

// The reading cursor on it or in it, as a comment card under it (`CommentCard`): only the border's colour changes, so
// nothing moves.
.itemThreadCodeThread_current {
  border-color: $color-current-edge;
}

.itemThreadCodeThread_linked {
  border-color: $color-current-edge;
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

// No gap or padding: each comment pads itself and draws the divider above it (`ReviewComment`).
.itemThreadCodeThread_body {
  display: flex;
  flex-direction: column;
}

// The code, above the first comment with no divider between: the comment's own padding is the space under it.
.itemThreadCodeThread_excerpt {
  padding: $spacing-12 $spacing-12 0;
}

// The comment under the reading cursor: a tint over its whole box, from the card's edge to its edge and divider to
// divider, and over the code's row above it when it is the first comment, so the tint runs from the card's top border.
// A fill only, so nothing moves.
.itemThreadCodeThread_currentComment,
.itemThreadCodeThread_excerpt:has(+ .itemThreadCodeThread_currentComment) {
  background: $color-current-tint;
}
</style>
