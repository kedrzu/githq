<!-- The toast of a comment box just discarded (D40, CR98), for the review's own `Toaster` at the foot of the diff, above the pending review's toolbar: what was discarded and its text quoted, clamped, for ten seconds; Restore (⌘Z while no text field has focus, where ⌘Z is the field's undo) brings it back, and Dismiss has no key, since Escape leaves the review. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Trash2, Undo2 } from 'lucide-vue-next';
import { computed } from 'vue';

import type { Command } from '@/commands/CommandTypes.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import { REVIEW_KEYS } from '../useReviewKeySheet.js';
import * as l from './ReviewDiscardedToast.loc.js';
import type { ReviewDiscardedComment } from './ReviewWriting.js';

const props = defineProps<{
  discarded: ReviewDiscardedComment;
}>();

const emit = defineEmits<{
  restore: [];
  /** It went, by its time or dismissed: what it held can no longer be restored. */
  close: [];
}>();

const t = useTranslate();

const title = computed(() => {
  const { threadId, startLine, line } = props.discarded.target;
  if (threadId !== null) {
    return t(l.reply);
  }

  return startLine === null ? t(l.onLine, { line }) : t(l.onLines, { start: startLine, end: line });
});
const commands = computed((): Command[] => [
  {
    id: 'review.restoreComment',
    title: t(l.restoreCommand),
    section: 'view',
    key: REVIEW_KEYS.restoreComment,
    icon: Undo2,
    menu: false,
    when: () => !isEditableTarget(document.activeElement),
    run: () => emit('restore'),
  },
]);

function onOpenChange(open: boolean) {
  if (!open) {
    emit('close');
  }
}
</script>

<template>
  <Toast
    :title="title"
    tone="accent"
    :icon="Trash2"
    lasts="long"
    :commands="commands"
    :dismiss-on-escape="false"
    @update:open="onOpenChange"
  >
    <span :class="css.reviewDiscardedToast_text">{{ t(l.quoted, { text: discarded.text.trim() }) }}</span>
    <template #actions="{ active }">
      <Button
        variant="secondary"
        size="sm"
        :kbd="active ? REVIEW_KEYS.restoreComment : undefined"
        :keyshortcuts="active ? formatAriaKeyShortcuts(REVIEW_KEYS.restoreComment) : undefined"
        @click="emit('restore')"
      >
        {{ t(l.restore) }}
      </Button>
    </template>
  </Toast>
</template>

<style lang="scss" module="css">
// A long comment shows its start: the toast stays a toast.
.reviewDiscardedToast_text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  white-space: pre-line;
}
</style>
