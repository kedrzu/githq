<!-- The comment box at the foot of a review's conversation, for a comment on the pull request itself; the words say what it goes on. `Mod+Enter` (⌘↵ on a Mac, Ctrl+↵ elsewhere) posts what is typed: the box empties and the comment shows at once among the others, on its way to GitHub. Quote reply puts the cursor in it (`focus`). What is typed is the pull request's draft (`text`), which the caller keeps. Without the right to comment it is read-only. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useTemplateRef } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import TextArea from '@/components/TextArea.vue';

import * as l from './ItemComposer.loc.js';

defineProps<{
  /** The user may not comment here. */
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  /** `Mod+Enter` with something typed. */
  submit: [body: string];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const SUBMIT_KEY = 'Mod+Enter';
const t = useTranslate();
const field = useTemplateRef('field');

defineExpose({
  /** Puts the cursor in the box: after a quote just put there. */
  focus: () => field.value?.focus(),
});

function onKeydown(event: KeyboardEvent) {
  if (!matchesCommandKey(event, SUBMIT_KEY)) {
    return;
  }

  event.preventDefault();
  const body = text.value.trim();
  if (body) {
    emit('submit', body);
    text.value = '';
  }
}
</script>

<template>
  <TextArea
    ref="field"
    v-model="text"
    :label="t(l.comment)"
    label-hidden
    :placeholder="placeholder ?? t(l.placeholder)"
    :readonly="disabled"
    compact
    :kbd="text ? SUBMIT_KEY : undefined"
    :keyshortcuts="formatAriaKeyShortcuts(SUBMIT_KEY)"
    @keydown="onKeydown"
  />
</template>
