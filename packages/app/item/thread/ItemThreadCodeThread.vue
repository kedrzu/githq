<!-- A thread on the code in an item's thread (`Activity / Code thread`, F5, F12): one card with the code it was written on (`ItemThreadExcerpt`) and its comments, then a band with the viewer's avatar and "Reply…", then one with Resolve thread — or, resolved, Unresolve and who resolved it. Reply and Resolve / Unresolve are offered only where GitHub says the viewer may (`viewerCanReply`, `viewerCanResolve`, `viewerCanUnresolve`). A resolved one, opened from its folded row (`ItemThreadResolvedRow`), has a head with Hide, which folds it again. A thread of the viewer's draft review (`draft`) has neither band: its comments reach nobody yet. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, CircleCheck, RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import ReviewThreadComment from '@/review/threads/ReviewThreadComment.vue';
import type { ItemUser } from '@/store/ItemTypes.js';

import * as l from './ItemThreadCodeThread.loc.js';
import ItemThreadExcerpt from './ItemThreadExcerpt.vue';

const props = defineProps<{
  thread: ReviewThread;
  /** Who is signed in: the reply band's avatar. */
  viewer?: ItemUser | null;
  /** In the viewer's draft review: no reply or resolve. */
  draft?: boolean;
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

const who = computed(() => props.thread.comments[0]?.author?.login ?? t(l.ghost));
const canReply = computed(() => !props.draft && props.thread.viewerCanReply);
const canToggle = computed(
  () => !props.draft && (props.thread.isResolved ? props.thread.viewerCanUnresolve : props.thread.viewerCanResolve),
);
/** Who resolved it, when GitHub says. */
const resolver = computed(() => (props.thread.isResolved ? props.thread.resolvedBy : null));
const viewerLogin = computed(() => props.viewer?.login ?? t(l.ghost));
</script>

<template>
  <div
    role="group"
    :aria-label="t(l.label, { who, path: thread.path })"
    :class="css.itemThreadCodeThread"
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
    </div>
    <div
      v-if="canReply"
      :class="css.itemThreadCodeThread_reply"
    >
      <Avatar
        :name="viewerLogin"
        :src="viewer?.avatarUrl"
        decorative
      />
      <Button
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
      v-if="canToggle || resolver"
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
    </div>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadCodeThread {
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
