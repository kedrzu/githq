<!-- The comment box along the bottom of an opened item (D1), and of a review's conversation, where `R` is the thread's and the words say what it goes on; `R` puts the cursor in it and `Mod+Enter` (⌘↵ on a Mac, Ctrl+↵ elsewhere) posts what is typed: the box empties and the comment shows at once among the others, on its way to GitHub. What is typed is the item's draft (`text`), kept while the user moves between items. Without the right to comment it is read-only. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useTemplateRef } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import TextArea from '@/components/TextArea.vue';

import * as l from './ItemComposer.loc.js';

withDefaults(
  defineProps<{
    /** The user may not comment here. */
    disabled?: boolean;
    placeholder?: string;
    /** The key that puts the cursor in it, for its hint; `null` when the screen gives it none. */
    focusKey?: string | null;
  }>(),
  { focusKey: EDIT_KEYS.comment },
);

const emit = defineEmits<{
  /** `Mod+Enter` with something typed. */
  submit: [body: string];
}>();

/** What is typed. */
const text = defineModel<string>('text', { default: '' });

const SUBMIT_KEY = 'Mod+Enter';
const t = useTranslate();
const fieldRef = useTemplateRef<InstanceType<typeof TextArea>>('field');

defineExpose({
  /** Puts the cursor in the box. */
  focus: () => fieldRef.value?.focus(),
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
    :kbd="text ? SUBMIT_KEY : (focusKey ?? undefined)"
    :aria-keyshortcuts="[focusKey, formatAriaKeyShortcuts(SUBMIT_KEY)].filter(Boolean).join(' ')"
    @keydown="onKeydown"
  />
</template>
