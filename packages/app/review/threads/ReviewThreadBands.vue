<!-- The two bands closing a code thread under its comments, the same in code review's diff (`ReviewThreadBox`) and on a pull request's thread (`ItemThreadCodeThread`): the Reply band (`Thread / Reply band`), on the band colour, with the viewer's avatar and "Reply…" — or what the thread says instead ("Add to your draft…") — showing its key, `R`, while the thread has the focus (`· focused`), and the reply being written in its place, growing downwards, the avatar level with its head (`· writing`); then the Resolve band (`Thread / Resolve band`): Resolve thread, or Unresolve on a resolved one, who resolved it, and why a change GitHub didn't take did not go through. Each band only when it holds something. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, RotateCcw } from 'lucide-vue-next';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import type { ItemUser } from '@/store/ItemTypes.js';

import * as l from './ReviewThreadBands.loc.js';

defineProps<{
  /** Who is signed in: the Reply band's avatar. */
  viewer?: ItemUser | null;
  /** GitHub lets the viewer reply: "Reply…" is offered. */
  canReply: boolean;
  /** Instead of "Reply…": where the reply goes ("Add to your draft…"). */
  replyLabel?: string;
  /** "Reply…"'s key, shown while the thread has the focus. */
  replyKey?: string;
  /** GitHub lets the viewer resolve it, or open it again. */
  canToggle: boolean;
  resolved: boolean;
  /** Who resolved it, by login, when GitHub says. */
  resolver?: string | null;
}>();

const emit = defineEmits<{
  /** "Reply…" was clicked. */
  reply: [];
  /** Resolve thread, or Unresolve. */
  setResolved: [resolved: boolean];
}>();

defineSlots<{
  /** The reply being written, in "Reply…"'s place. */
  box?(): unknown;
  /** Why a change of the thread GitHub didn't take did not go through, after the resolve button. */
  notes?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <div
    v-if="canReply || $slots.box"
    :class="css.reviewThreadBands_reply"
  >
    <span :class="css.reviewThreadBands_rail">
      <Avatar
        :name="viewer?.login ?? t(l.ghost)"
        :src="viewer?.avatarUrl"
        decorative
      />
    </span>
    <div
      v-if="$slots.box"
      :class="css.reviewThreadBands_box"
    >
      <slot name="box" />
    </div>
    <Button
      v-else
      :class="css.reviewThreadBands_field"
      variant="field"
      size="compact"
      block
      :kbd="replyKey"
      :keyshortcuts="replyKey"
      @click="emit('reply')"
    >
      {{ replyLabel ?? t(l.reply) }}
    </Button>
  </div>
  <div
    v-if="canToggle || resolver || $slots.notes"
    :class="css.reviewThreadBands_resolve"
  >
    <Button
      v-if="canToggle"
      :class="!resolved && css.reviewThreadBands_resolveButton"
      size="compact"
      :icon="resolved ? RotateCcw : CircleCheck"
      @click="emit('setResolved', !resolved)"
    >
      {{ resolved ? t(l.unresolve) : t(l.resolve) }}
    </Button>
    <span
      v-if="resolver"
      :class="css.reviewThreadBands_status"
      >{{ t(l.resolvedBy, { who: resolver }) }}</span
    >
    <slot name="notes" />
  </div>
</template>

<style lang="scss" module="css">
// The avatar level with "Reply…", and with the head of the reply being written, the band growing downwards.
.reviewThreadBands_reply {
  display: flex;
  gap: $spacing-10;
  align-items: flex-start;
  padding: $spacing-8 $spacing-12;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}

.reviewThreadBands_rail {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 30px;
}

.reviewThreadBands_box {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewThreadBands_reply .reviewThreadBands_field {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 $spacing-8 0 $spacing-10;
  border-color: $color-border-2;
}

.reviewThreadBands_resolve {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-8 $spacing-12;
  border-top: 1px solid $color-border;
}

.reviewThreadBands_resolveButton {
  --button-icon-color: #{$color-green};
}

.reviewThreadBands_status {
  min-width: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
