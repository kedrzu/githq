<!-- A thread on the code in an item's thread (`Activity / Code thread`, F5, F12): one card with the code it was written on (`ItemThreadExcerpt`) and its comments, then a band with the viewer's avatar and "Reply…", then one with Resolve thread — or, resolved, Unresolve and who resolved it. Reply and Resolve / Unresolve are offered only where GitHub says the viewer may (`viewerCanReply`, `viewerCanResolve`, `viewerCanUnresolve`). A resolved one, opened from its folded row (`ItemThreadResolvedRow`), has a head with Hide, which folds it again. A thread of the viewer's draft review (`draft`) has neither band: its comments reach nobody yet. "Reply…" opens the reply editor in its band (`Activity / Code thread · replying`, F10), growing downwards: Cancel (`Escape`) and Reply (`Mod+Enter`), the question before a reply with text is let go; a reply sent shows at once among the comments, "Sending…" or "Pending" as code review says, and one GitHub refused comes back in the editor with why, its text kept (`CodeThreadReplies`). A change of state GitHub didn't take says so in the resolve band. The card takes the focus (`data-code-thread`) when clicked or moved to with J/K (`ItemThread`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, CircleCheck, RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import ReviewThreadComment from '@/review/threads/ReviewThreadComment.vue';
import ReviewFailureNote from '@/review/writing/ReviewFailureNote.vue';
import ReviewSentComment from '@/review/writing/ReviewSentComment.vue';
import { useCommentFailureText } from '@/review/writing/useCommentFailureText.js';
import { useResolveFailureText } from '@/review/writing/useResolveFailureText.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import type { CodeThreadReplies } from './CodeThreadReplies.js';
import * as l from './ItemThreadCodeThread.loc.js';
import ItemThreadEditor from './ItemThreadEditor.vue';
import ItemThreadExcerpt from './ItemThreadExcerpt.vue';

const props = defineProps<{
  thread: ReviewThread;
  /** Who is signed in: the reply band's avatar. */
  viewer?: ItemUser | null;
  /** In the viewer's draft review: no reply or resolve. */
  draft?: boolean;
  /** The viewer's replies and what writes them; none, "Reply…" only says it was clicked. */
  replies?: CodeThreadReplies | null;
}>();

const emit = defineEmits<{
  /** Fold the resolved thread again. */
  hide: [];
  /** "Reply…" was clicked. */
  reply: [];
  /** Resolve thread, or Unresolve. */
  setResolved: [resolved: boolean];
}>();

const t = useTranslate();
const getCommentFailureText = useCommentFailureText();
const getResolveFailureText = useResolveFailureText();

const who = computed(() => props.thread.comments[0]?.author?.login ?? t(l.ghost));
const canReply = computed(() => !props.draft && props.thread.viewerCanReply);
const canToggle = computed(
  () => !props.draft && (props.thread.isResolved ? props.thread.viewerCanUnresolve : props.thread.viewerCanResolve),
);
/** Who resolved it, when GitHub says. */
const resolver = computed(() => (props.thread.isResolved ? props.thread.resolvedBy : null));
const viewerLogin = computed(() => props.viewer?.login ?? t(l.ghost));
const reply = computed(() => props.replies?.get(props.thread.id) ?? null);
const box = computed(() => reply.value?.box ?? null);
const resolveFailure = computed(() => {
  const failure = props.replies?.getResolveFailure(props.thread.id) ?? null;
  return failure && getResolveFailureText(failure, props.thread.isResolved);
});
</script>

<template>
  <div
    role="group"
    :aria-label="t(l.label, { who, path: thread.path })"
    :class="css.itemThreadCodeThread"
    :data-code-thread="thread.id"
    tabindex="-1"
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
      <button
        type="button"
        :class="css.itemThreadCodeThread_hide"
        aria-expanded="true"
        @click="emit('hide')"
      >
        {{ t(l.hide) }}
      </button>
    </p>
    <div :class="css.itemThreadCodeThread_body">
      <ItemThreadExcerpt :thread="thread" />
      <ReviewThreadComment
        v-for="comment in thread.comments"
        :key="comment.id"
        :comment="comment"
      />
      <ReviewSentComment
        v-for="sent in reply?.sent ?? []"
        :key="sent.id"
        :status="sent.status"
        :author="viewer ?? null"
      />
    </div>
    <div
      v-if="canReply"
      :class="[css.itemThreadCodeThread_reply, box && css.itemThreadCodeThread_reply_open]"
    >
      <Avatar
        :name="viewerLogin"
        :src="viewer?.avatarUrl"
        decorative
      />
      <div
        v-if="box && replies"
        :class="css.itemThreadCodeThread_replyBox"
      >
        <ItemThreadEditor
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
          @update:asking="replies.setAsking(thread.id, $event)"
          @save="replies.send(thread.id)"
          @cancel="replies.cancel(thread.id)"
        />
        <ReviewFailureNote
          v-if="box.failure"
          :text="getCommentFailureText(box.failure)"
        />
      </div>
      <Button
        v-else
        :class="css.itemThreadCodeThread_replyField"
        variant="field"
        size="compact"
        block
        @click="emit('reply')"
      >
        {{ t(l.reply) }}
      </Button>
    </div>
    <div
      v-if="canToggle || resolver || resolveFailure"
      :class="css.itemThreadCodeThread_actions"
    >
      <Button
        v-if="canToggle"
        :class="!thread.isResolved && css.itemThreadCodeThread_resolve"
        size="compact"
        :icon="thread.isResolved ? RotateCcw : CircleCheck"
        @click="emit('setResolved', !thread.isResolved)"
      >
        {{ thread.isResolved ? t(l.unresolve) : t(l.resolve) }}
      </Button>
      <span
        v-if="resolver"
        :class="css.itemThreadCodeThread_status"
        >{{ t(l.resolvedBy, { who: resolver.login }) }}</span
      >
      <ReviewFailureNote
        v-if="resolveFailure"
        :text="resolveFailure"
      />
    </div>
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
  @include focus-ring;

  padding: 0;
  font: inherit;
  font-size: $font-size-xs;
  color: $color-accent;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;

  &:hover {
    text-decoration: underline;
  }
}

.itemThreadCodeThread_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-12;
}

.itemThreadCodeThread_reply {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}

// The editor open: the avatar level with its head, the band growing downwards.
.itemThreadCodeThread_reply_open {
  align-items: flex-start;
  padding: $spacing-10 $spacing-12;
}

.itemThreadCodeThread_replyBox {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.itemThreadCodeThread_reply .itemThreadCodeThread_replyField {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 $spacing-8 0 $spacing-10;
  border-color: $color-border-2;
}

.itemThreadCodeThread_actions {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  border-top: 1px solid $color-border;
}

.itemThreadCodeThread_resolve {
  --button-icon-color: #{$color-green};
}

.itemThreadCodeThread_status {
  min-width: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
